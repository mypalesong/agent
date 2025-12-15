---
sidebar_position: 2
title: 중급 - Checkpointing과 Memory
description: 상태 지속성, 메모리 시스템, Human-in-the-loop 구현
---

# LangGraph 중급 가이드

이 가이드에서는 LangGraph의 핵심 중급 기능들을 다룹니다: **Checkpointing**, **Memory**, **Human-in-the-loop**, **Streaming**.

## Checkpointing (체크포인팅)

체크포인팅은 그래프의 상태를 저장하고 복원하는 기능입니다. 이를 통해:
- 대화 세션 유지
- 실패 후 복구
- 상태 기반 인터럽트

### 기본 체크포인터 설정

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END

# 인메모리 체크포인터 생성
checkpointer = MemorySaver()

# 그래프 빌더
builder = StateGraph(ChatState)
builder.add_node("chatbot", chat_node)
builder.add_edge(START, "chatbot")
builder.add_edge("chatbot", END)

# 체크포인터와 함께 컴파일
graph = builder.compile(checkpointer=checkpointer)
```

### Thread를 이용한 세션 관리

`thread_id`를 사용하여 독립적인 대화 세션을 관리합니다:

```python
# 첫 번째 대화 - 세션 1
config_1 = {"configurable": {"thread_id": "session_1"}}
result = graph.invoke(
    {"messages": [{"role": "user", "content": "내 이름은 철수야"}]},
    config=config_1
)

# 같은 세션에서 이어서 대화
result = graph.invoke(
    {"messages": [{"role": "user", "content": "내 이름이 뭐라고 했지?"}]},
    config=config_1
)
# 출력: "네 이름은 철수라고 하셨습니다."

# 다른 세션 - 세션 2 (별도의 컨텍스트)
config_2 = {"configurable": {"thread_id": "session_2"}}
result = graph.invoke(
    {"messages": [{"role": "user", "content": "내 이름이 뭐라고 했지?"}]},
    config=config_2
)
# 출력: "이름을 말씀해 주시지 않으셨습니다."
```

### 영구 체크포인터 (SQLite/PostgreSQL)

프로덕션에서는 영구 저장소를 사용합니다:

```python
# SQLite 체크포인터
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
graph = builder.compile(checkpointer=checkpointer)
```

```python
# PostgreSQL 체크포인터 (비동기)
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def main():
    async with AsyncPostgresSaver.from_conn_string(
        "postgresql://user:pass@localhost/db"
    ) as checkpointer:
        graph = builder.compile(checkpointer=checkpointer)
        # 그래프 사용...
```

### 체크포인트 상태 조회

```python
# 현재 상태 가져오기
state = graph.get_state(config_1)
print(state.values)  # 현재 상태 값
print(state.next)    # 다음 실행될 노드

# 상태 히스토리 조회
for state in graph.get_state_history(config_1):
    print(f"Step: {state.metadata['step']}")
    print(f"Values: {state.values}")
```

## Memory (메모리 시스템)

LangGraph는 세 가지 유형의 메모리를 지원합니다:

### 1. 단기 메모리 (Short-term Memory)

대화 컨텍스트 내에서 유지되는 메모리입니다. 체크포인터를 통해 자동 관리됩니다.

```python
class StateWithMemory(TypedDict):
    messages: Annotated[list, add_messages]
    # 단기 메모리: 현재 대화에서만 유효
    current_topic: str
    user_preferences: dict
```

### 2. 대화 히스토리 관리

긴 대화에서 토큰 제한을 관리하는 방법:

```python
from langchain_core.messages import trim_messages

def chatbot_with_memory(state: StateWithMemory):
    """메시지 트리밍이 적용된 챗봇"""

    # 최근 N개 메시지만 유지
    trimmed = trim_messages(
        state["messages"],
        max_tokens=4000,
        strategy="last",
        token_counter=llm,
        include_system=True,  # 시스템 메시지 유지
        allow_partial=False
    )

    response = llm.invoke(trimmed)
    return {"messages": [response]}
```

### 3. 장기 메모리 (Long-term Memory)

세션을 넘어 지속되는 메모리를 구현합니다:

```python
from langgraph.store.memory import InMemoryStore

# 메모리 스토어 생성
memory_store = InMemoryStore()

class StateWithLongTermMemory(TypedDict):
    messages: Annotated[list, add_messages]
    user_id: str

def node_with_long_term_memory(state: StateWithLongTermMemory, store):
    """장기 메모리를 사용하는 노드"""
    user_id = state["user_id"]

    # 저장된 사용자 정보 조회
    user_data = store.get(namespace=("users",), key=user_id)

    if user_data:
        context = f"사용자 정보: {user_data.value}"
    else:
        context = "새로운 사용자입니다."

    # LLM 호출 시 컨텍스트 활용
    messages = state["messages"] + [
        {"role": "system", "content": context}
    ]
    response = llm.invoke(messages)

    # 새로운 정보 저장
    store.put(
        namespace=("users",),
        key=user_id,
        value={"last_interaction": "...", "preferences": {...}}
    )

    return {"messages": [response]}

# 그래프에 스토어 연결
graph = builder.compile(
    checkpointer=checkpointer,
    store=memory_store
)
```

## Human-in-the-loop (휴먼 인더 루프)

중요한 결정에서 인간의 승인을 받는 워크플로우를 구현합니다.

### Interrupt 설정

```python
from langgraph.graph import StateGraph, START, END

builder = StateGraph(State)
builder.add_node("agent", agent_node)
builder.add_node("sensitive_action", sensitive_action_node)
builder.add_node("execute", execute_node)

builder.add_edge(START, "agent")
builder.add_edge("agent", "sensitive_action")
builder.add_edge("sensitive_action", "execute")
builder.add_edge("execute", END)

# sensitive_action 노드 전에 인터럽트
graph = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["sensitive_action"]
)
```

### 인터럽트 워크플로우

```python
# 1단계: 그래프 실행 (sensitive_action 전에 멈춤)
config = {"configurable": {"thread_id": "approval_session"}}
result = graph.invoke(
    {"messages": [{"role": "user", "content": "계좌에서 100만원 송금해줘"}]},
    config=config
)

# 2단계: 현재 상태 확인
state = graph.get_state(config)
print(f"다음 노드: {state.next}")  # ['sensitive_action']
print(f"실행 예정 작업: {state.values}")

# 3단계: 인간이 검토 후 승인/거부
user_approval = input("이 작업을 승인하시겠습니까? (yes/no): ")

if user_approval == "yes":
    # 승인: 실행 계속
    result = graph.invoke(None, config=config)
else:
    # 거부: 상태 수정 후 재실행
    graph.update_state(
        config,
        {"messages": [{"role": "assistant", "content": "작업이 취소되었습니다."}]}
    )
```

### 상태 수정 (State Update)

```python
# 현재 상태 가져오기
current_state = graph.get_state(config)

# 상태 수정
graph.update_state(
    config,
    {
        "messages": [
            {"role": "user", "content": "수정된 요청입니다"}
        ],
        "approved": True
    },
    # 특정 노드로 돌아가기 (선택사항)
    as_node="agent"
)

# 수정된 상태로 계속 실행
result = graph.invoke(None, config=config)
```

## Streaming (스트리밍)

LangGraph는 다양한 스트리밍 모드를 지원합니다.

### 노드 출력 스트리밍

```python
# 각 노드의 출력을 스트리밍
config = {"configurable": {"thread_id": "stream_session"}}

for event in graph.stream(
    {"messages": [{"role": "user", "content": "긴 이야기 해줘"}]},
    config=config,
    stream_mode="values"
):
    print(f"현재 상태: {event}")
```

### 토큰 단위 스트리밍

LLM 응답을 토큰 단위로 스트리밍합니다:

```python
# 토큰 스트리밍
async for event in graph.astream(
    {"messages": [{"role": "user", "content": "안녕하세요"}]},
    config=config,
    stream_mode="messages"
):
    if event[0].content:
        print(event[0].content, end="", flush=True)
```

### 이벤트 스트리밍

```python
# 모든 이벤트 스트리밍
async for event in graph.astream_events(
    {"messages": [{"role": "user", "content": "분석해줘"}]},
    config=config,
    version="v2"
):
    kind = event["event"]

    if kind == "on_chat_model_stream":
        # LLM 토큰
        content = event["data"]["chunk"].content
        if content:
            print(content, end="")

    elif kind == "on_tool_start":
        # 도구 실행 시작
        print(f"\n도구 시작: {event['name']}")

    elif kind == "on_tool_end":
        # 도구 실행 완료
        print(f"도구 완료: {event['data']['output']}")
```

### Stream Mode 비교

| Mode | 설명 | 사용 사례 |
|------|------|----------|
| `values` | 각 단계의 전체 상태 | 상태 변화 추적 |
| `updates` | 각 노드의 업데이트만 | 효율적인 업데이트 |
| `messages` | 메시지 토큰 스트림 | 실시간 채팅 UI |
| `debug` | 상세 디버그 정보 | 개발/디버깅 |

## Tool Calling (도구 호출)

### 도구 정의와 바인딩

```python
from langchain_core.tools import tool
from typing import Literal

@tool
def get_stock_price(symbol: str) -> dict:
    """주식 가격을 조회합니다.

    Args:
        symbol: 주식 심볼 (예: AAPL, GOOGL)
    """
    # 실제로는 API 호출
    return {"symbol": symbol, "price": 150.25, "change": "+2.3%"}

@tool
def execute_trade(
    symbol: str,
    quantity: int,
    action: Literal["buy", "sell"]
) -> dict:
    """주식 거래를 실행합니다.

    Args:
        symbol: 주식 심볼
        quantity: 수량
        action: 매수 또는 매도
    """
    return {"status": "completed", "order_id": "ORD123"}

tools = [get_stock_price, execute_trade]
llm_with_tools = ChatOpenAI(model="gpt-4o").bind_tools(tools)
```

### 도구 호출 처리

```python
from langgraph.prebuilt import ToolNode

def agent(state: State):
    """에이전트가 도구 호출을 결정"""
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def should_use_tools(state: State) -> str:
    """도구 호출 여부 판단"""
    last_message = state["messages"][-1]

    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"

# 그래프 구성
builder = StateGraph(State)
builder.add_node("agent", agent)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_use_tools, {
    "tools": "tools",
    "end": END
})
builder.add_edge("tools", "agent")

graph = builder.compile(checkpointer=checkpointer)
```

### 도구에서 상태 업데이트

```python
from langgraph.types import Command

@tool
def update_user_preference(preference: str) -> Command:
    """사용자 선호도를 업데이트하고 상태를 수정합니다."""

    return Command(
        # 상태 업데이트
        update={"user_preferences": {"theme": preference}},
        # 다음 노드 지정 (선택사항)
        goto="confirmation_node"
    )
```

## 에러 처리와 재시도

```python
from langgraph.errors import GraphRecursionError

def robust_node(state: State):
    """재시도 로직이 포함된 노드"""
    max_retries = 3

    for attempt in range(max_retries):
        try:
            response = llm.invoke(state["messages"])
            return {"messages": [response]}
        except Exception as e:
            if attempt == max_retries - 1:
                # 마지막 시도 실패
                return {
                    "messages": [{
                        "role": "assistant",
                        "content": f"처리 중 오류가 발생했습니다: {str(e)}"
                    }],
                    "error": str(e)
                }
            # 재시도 전 대기
            import time
            time.sleep(2 ** attempt)

# 그래프 레벨 재귀 제한
try:
    result = graph.invoke(
        {"messages": [...]},
        config={"recursion_limit": 25}  # 기본값: 25
    )
except GraphRecursionError:
    print("그래프가 너무 많이 반복되었습니다.")
```

## 실습: 승인 기반 주식 거래 봇

```python
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode

class TradingState(TypedDict):
    messages: Annotated[list, add_messages]
    pending_trade: dict | None
    trade_approved: bool

def trading_agent(state: TradingState):
    """거래 에이전트"""
    response = llm_with_tools.invoke(state["messages"])

    # 거래 도구 호출 감지
    if response.tool_calls:
        for call in response.tool_calls:
            if call["name"] == "execute_trade":
                return {
                    "messages": [response],
                    "pending_trade": call["args"]
                }

    return {"messages": [response]}

def check_approval_needed(state: TradingState) -> str:
    """승인이 필요한지 확인"""
    if state.get("pending_trade"):
        return "needs_approval"

    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"

# 그래프 구성
builder = StateGraph(TradingState)
builder.add_node("agent", trading_agent)
builder.add_node("tools", ToolNode([get_stock_price]))  # 조회만
builder.add_node("execute_trade", lambda s: {...})  # 실제 거래

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", check_approval_needed, {
    "tools": "tools",
    "needs_approval": END,  # 여기서 멈춤 - 승인 대기
    "end": END
})
builder.add_edge("tools", "agent")

checkpointer = MemorySaver()
graph = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["execute_trade"]  # 거래 전 인터럽트
)
```

## 다음 단계

중급 내용을 마스터했다면, [고급 가이드](./advanced.md)에서 다음을 학습하세요:

- **Multi-Agent 워크플로우**: 여러 에이전트 협업
- **Subgraphs**: 그래프 내 그래프 구성
- **분산 시스템**: 대규모 배포
- **성능 최적화**: 캐싱, 병렬 처리

## 참고 자료

- [LangGraph Persistence 가이드](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph-persistence/)
- [Human-in-the-loop 패턴](https://docs.langchain.com/oss/python/langgraph/overview)
- [Streaming 가이드](https://docs.langchain.com/oss/python/langgraph/overview)
