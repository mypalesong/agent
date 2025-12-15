---
sidebar_position: 1
title: 기초 - LangGraph 시작하기
description: LangGraph의 기본 개념과 핵심 컴포넌트를 학습합니다
---

# LangGraph 기초 가이드

LangGraph는 LangChain 위에 구축된 라이브러리로, **상태 기반(Stateful)**, **순환적(Cyclic)**, **멀티-액터(Multi-actor)** LLM 애플리케이션을 구축하기 위해 설계되었습니다. Klarna, Replit, Elastic, Uber, LinkedIn 등 글로벌 기업들이 프로덕션 환경에서 사용하고 있습니다.

## LangGraph란?

LangGraph는 에이전트 워크플로우를 **그래프(Graph)** 구조로 표현합니다. 각 단계를 노드로, 흐름을 엣지로 정의하여 복잡한 AI 에이전트 시스템을 구축할 수 있습니다.

### 핵심 특징

| 특징 | 설명 |
|------|------|
| **상태 관리** | 그래프 전체에서 공유되는 상태를 통해 컨텍스트 유지 |
| **순환 지원** | 단순 DAG를 넘어 순환 그래프 지원으로 반복적 추론 가능 |
| **지속성** | 체크포인트를 통한 상태 저장 및 복원 |
| **Human-in-the-loop** | 인간 개입 지점 설정 가능 |

## 핵심 개념

### 1. State (상태)

State는 그래프의 "메모리"입니다. 모든 노드가 공유하는 데이터 스키마를 정의합니다.

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

# 상태 스키마 정의
class State(TypedDict):
    # add_messages 리듀서: 메시지를 덮어쓰지 않고 추가
    messages: Annotated[list, add_messages]
    # 추가 상태 필드
    current_step: str
    results: dict
```

#### Reducer 함수

Reducer는 상태 업데이트 방식을 정의합니다:

```python
from operator import add

class State(TypedDict):
    # 리스트 항목을 누적 (기존 + 새로운)
    items: Annotated[list, add]
    # 단순 덮어쓰기 (리듀서 없음)
    counter: int
```

### 2. Node (노드)

노드는 실제 작업을 수행하는 함수입니다. 현재 상태를 입력받고, 업데이트된 상태를 반환합니다.

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")

def chatbot_node(state: State) -> dict:
    """챗봇 응답을 생성하는 노드"""
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def analyzer_node(state: State) -> dict:
    """사용자 의도를 분석하는 노드"""
    last_message = state["messages"][-1].content
    # 분석 로직...
    return {"current_step": "analyzed"}
```

### 3. Edge (엣지)

엣지는 노드 간의 흐름을 정의합니다.

#### 일반 엣지 (Normal Edge)
```python
# A 노드 실행 후 항상 B 노드로 이동
graph.add_edge("node_a", "node_b")
```

#### 조건부 엣지 (Conditional Edge)
```python
def should_continue(state: State) -> str:
    """다음 노드를 결정하는 라우터 함수"""
    last_message = state["messages"][-1]

    # 도구 호출이 있으면 tool 노드로
    if last_message.tool_calls:
        return "tools"
    # 그렇지 않으면 종료
    return "end"

# 조건부 엣지 추가
graph.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tool_node",
        "end": END
    }
)
```

## 첫 번째 그래프 만들기

간단한 챗봇을 만들어 봅시다.

### Step 1: 패키지 설치

```bash
pip install langgraph langchain-openai
```

### Step 2: 상태 정의

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
```

### Step 3: 노드 함수 정의

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")

def chat_node(state: ChatState):
    """LLM 응답을 생성하는 노드"""
    response = llm.invoke(state["messages"])
    return {"messages": [response]}
```

### Step 4: 그래프 구성 및 컴파일

```python
from langgraph.graph import StateGraph, START, END

# 그래프 빌더 생성
builder = StateGraph(ChatState)

# 노드 추가
builder.add_node("chatbot", chat_node)

# 엣지 추가
builder.add_edge(START, "chatbot")
builder.add_edge("chatbot", END)

# 그래프 컴파일
graph = builder.compile()
```

### Step 5: 실행

```python
# 그래프 실행
result = graph.invoke({
    "messages": [{"role": "user", "content": "안녕하세요!"}]
})

print(result["messages"][-1].content)
```

## 그래프 시각화

LangGraph는 그래프 구조를 시각화할 수 있습니다:

```python
# ASCII 출력
print(graph.get_graph().draw_ascii())

# Mermaid 다이어그램 (Jupyter에서)
from IPython.display import Image, display
display(Image(graph.get_graph().draw_mermaid_png()))
```

출력 예시:
```
    +-----------+
    | __start__ |
    +-----------+
          |
          v
    +-----------+
    |  chatbot  |
    +-----------+
          |
          v
    +-----------+
    |  __end__  |
    +-----------+
```

## 도구(Tool) 연동하기

에이전트에 도구를 연결하여 외부 기능을 사용할 수 있습니다.

### 도구 정의

```python
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """도시의 날씨 정보를 가져옵니다."""
    # 실제로는 API 호출
    return f"{city}의 날씨: 맑음, 20°C"

@tool
def search_web(query: str) -> str:
    """웹 검색을 수행합니다."""
    return f"'{query}'에 대한 검색 결과..."

tools = [get_weather, search_web]
```

### 도구가 있는 에이전트 그래프

```python
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI

# 도구가 바인딩된 LLM
llm_with_tools = ChatOpenAI(model="gpt-4o-mini").bind_tools(tools)

def agent_node(state: ChatState):
    """에이전트 노드: LLM이 도구 호출 여부 결정"""
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: ChatState) -> str:
    """도구 호출이 필요한지 판단"""
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return "end"

# 그래프 구성
builder = StateGraph(ChatState)
builder.add_node("agent", agent_node)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "agent")
builder.add_conditional_edges(
    "agent",
    should_continue,
    {"tools": "tools", "end": END}
)
builder.add_edge("tools", "agent")  # 도구 실행 후 다시 에이전트로

graph = builder.compile()
```

### 실행 예시

```python
result = graph.invoke({
    "messages": [{"role": "user", "content": "서울 날씨 어때?"}]
})

# 에이전트가 get_weather 도구를 호출하고 결과를 기반으로 응답
print(result["messages"][-1].content)
# 출력: "서울의 현재 날씨는 맑고 기온은 20°C입니다."
```

## 기본 에러 처리

```python
def safe_node(state: ChatState):
    """에러 처리가 포함된 노드"""
    try:
        response = llm.invoke(state["messages"])
        return {"messages": [response]}
    except Exception as e:
        # 에러 메시지를 상태에 추가
        error_message = {"role": "assistant", "content": f"오류 발생: {str(e)}"}
        return {"messages": [error_message]}
```

## Prebuilt 컴포넌트 활용

LangGraph는 자주 사용되는 패턴을 위한 prebuilt 컴포넌트를 제공합니다:

```python
from langgraph.prebuilt import create_react_agent

# ReAct 에이전트 빠르게 생성
agent = create_react_agent(
    model=ChatOpenAI(model="gpt-4o-mini"),
    tools=[get_weather, search_web]
)

# 실행
result = agent.invoke({
    "messages": [{"role": "user", "content": "날씨 정보 알려줘"}]
})
```

## 주요 개념 정리

```
┌─────────────────────────────────────────────────────────────┐
│                      LangGraph 구조                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   State (상태)                                              │
│   └── 그래프 전체에서 공유되는 데이터                        │
│       └── Reducer로 업데이트 방식 정의                      │
│                                                             │
│   Node (노드)                                               │
│   └── 실제 작업을 수행하는 함수                             │
│       └── 상태를 입력받고 업데이트 반환                     │
│                                                             │
│   Edge (엣지)                                               │
│   └── 노드 간 흐름 정의                                     │
│       ├── Normal Edge: 무조건 이동                          │
│       └── Conditional Edge: 조건에 따라 분기                │
│                                                             │
│   Graph (그래프)                                            │
│   └── 노드와 엣지의 조합                                    │
│       └── compile() 후 invoke()로 실행                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 다음 단계

기초 개념을 이해했다면, [중급 가이드](./02-intermediate.md)에서 다음 내용을 학습하세요:

- **Checkpointing**: 상태 지속성과 세션 관리
- **Memory**: 단기/장기 메모리 구현
- **Human-in-the-loop**: 인간 개입 워크플로우
- **Streaming**: 실시간 응답 스트리밍

## 참고 자료

- [LangGraph 공식 문서](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph GitHub](https://github.com/langchain-ai/langgraph)
- [LangChain Academy - LangGraph 무료 강좌](https://www.langchain.com/langgraph)
