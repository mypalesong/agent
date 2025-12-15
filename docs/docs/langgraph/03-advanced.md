---
sidebar_position: 3
title: 고급 - Multi-Agent와 Subgraphs
description: 복잡한 멀티-에이전트 시스템과 고급 아키텍처 패턴
---

# LangGraph 고급 가이드

이 가이드에서는 프로덕션 레벨의 복잡한 시스템을 구축하기 위한 고급 기능을 다룹니다: **Multi-Agent 워크플로우**, **Subgraphs**, **Hierarchical 구조**, **성능 최적화**.

## Multi-Agent 워크플로우

여러 전문 에이전트가 협력하여 복잡한 작업을 수행하는 시스템을 구축합니다.

### 아키텍처 패턴

```
┌─────────────────────────────────────────────────────────────┐
│                  Multi-Agent 아키텍처 패턴                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Supervisor 패턴                                         │
│     ┌──────────┐                                           │
│     │Supervisor│ ──→ 작업 분배 및 조율                      │
│     └────┬─────┘                                           │
│          │                                                  │
│     ┌────┼────┬────────┐                                   │
│     ▼    ▼    ▼        ▼                                   │
│   Agent1 Agent2 Agent3 Agent4                              │
│                                                             │
│  2. Hierarchical 패턴                                       │
│     ┌──────────┐                                           │
│     │  Leader  │                                           │
│     └────┬─────┘                                           │
│          │                                                  │
│     ┌────┴────┐                                            │
│     ▼         ▼                                            │
│   Team A    Team B (각 팀이 별도 그래프)                    │
│                                                             │
│  3. Swarm 패턴                                              │
│     동적 핸드오프: Agent A ↔ Agent B ↔ Agent C             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Supervisor 패턴 구현

```python
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

class SupervisorState(TypedDict):
    messages: Annotated[list, add_messages]
    next_agent: str
    task_results: dict

# 전문 에이전트들
def researcher_agent(state: SupervisorState):
    """리서처 에이전트: 정보 수집 전문"""
    llm = ChatOpenAI(model="gpt-4o")
    system = "당신은 전문 리서처입니다. 정보를 수집하고 분석합니다."

    messages = [SystemMessage(content=system)] + state["messages"]
    response = llm.invoke(messages)

    return {
        "messages": [response],
        "task_results": {
            **state.get("task_results", {}),
            "research": response.content
        }
    }

def coder_agent(state: SupervisorState):
    """코더 에이전트: 코드 작성 전문"""
    llm = ChatOpenAI(model="gpt-4o")
    system = "당신은 전문 프로그래머입니다. 코드를 작성하고 리뷰합니다."

    messages = [SystemMessage(content=system)] + state["messages"]
    response = llm.invoke(messages)

    return {
        "messages": [response],
        "task_results": {
            **state.get("task_results", {}),
            "code": response.content
        }
    }

def writer_agent(state: SupervisorState):
    """작가 에이전트: 문서 작성 전문"""
    llm = ChatOpenAI(model="gpt-4o")
    system = "당신은 전문 테크니컬 라이터입니다."

    messages = [SystemMessage(content=system)] + state["messages"]
    response = llm.invoke(messages)

    return {
        "messages": [response],
        "task_results": {
            **state.get("task_results", {}),
            "document": response.content
        }
    }

# Supervisor 노드
def supervisor(state: SupervisorState):
    """작업을 적절한 에이전트에게 분배"""
    llm = ChatOpenAI(model="gpt-4o")

    system = """당신은 팀 슈퍼바이저입니다.
    사용자의 요청을 분석하고 적절한 에이전트를 선택하세요.

    사용 가능한 에이전트:
    - researcher: 정보 수집, 분석
    - coder: 코드 작성, 디버깅
    - writer: 문서 작성, 편집
    - FINISH: 모든 작업 완료

    다음 에이전트를 선택하세요."""

    response = llm.invoke([
        SystemMessage(content=system),
        *state["messages"]
    ])

    # 응답에서 다음 에이전트 파싱
    content = response.content.lower()
    if "researcher" in content:
        next_agent = "researcher"
    elif "coder" in content:
        next_agent = "coder"
    elif "writer" in content:
        next_agent = "writer"
    else:
        next_agent = "FINISH"

    return {"next_agent": next_agent, "messages": [response]}

def route_to_agent(state: SupervisorState) -> str:
    """다음 에이전트로 라우팅"""
    return state["next_agent"]

# 그래프 구성
builder = StateGraph(SupervisorState)

# 노드 추가
builder.add_node("supervisor", supervisor)
builder.add_node("researcher", researcher_agent)
builder.add_node("coder", coder_agent)
builder.add_node("writer", writer_agent)

# 엣지 구성
builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    route_to_agent,
    {
        "researcher": "researcher",
        "coder": "coder",
        "writer": "writer",
        "FINISH": END
    }
)

# 각 에이전트 → 다시 supervisor로
builder.add_edge("researcher", "supervisor")
builder.add_edge("coder", "supervisor")
builder.add_edge("writer", "supervisor")

graph = builder.compile()
```

### Swarm 패턴 (동적 핸드오프)

```python
from langgraph_swarm import create_swarm, Agent

# Swarm 에이전트 정의
sales_agent = Agent(
    name="Sales Agent",
    instructions="고객 판매를 담당합니다.",
    tools=[check_inventory, process_order],
    handoff_to=["Support Agent", "Returns Agent"]
)

support_agent = Agent(
    name="Support Agent",
    instructions="기술 지원을 담당합니다.",
    tools=[lookup_issue, create_ticket],
    handoff_to=["Sales Agent"]
)

returns_agent = Agent(
    name="Returns Agent",
    instructions="반품 처리를 담당합니다.",
    tools=[process_return, check_eligibility],
    handoff_to=["Sales Agent", "Support Agent"]
)

# Swarm 생성
swarm = create_swarm(
    agents=[sales_agent, support_agent, returns_agent],
    default_agent="Sales Agent"
)

# 실행 - 에이전트가 필요에 따라 동적으로 핸드오프
result = swarm.invoke({
    "messages": [{"role": "user", "content": "제품에 문제가 있어서 반품하고 싶어요"}]
})
```

## Subgraphs (서브그래프)

복잡한 시스템을 모듈화하여 관리합니다.

### 서브그래프 정의

```python
from langgraph.graph import StateGraph, START, END

# 서브그래프 1: 데이터 처리 파이프라인
class DataState(TypedDict):
    raw_data: str
    processed_data: dict
    validation_status: str

def extract_data(state: DataState):
    """데이터 추출"""
    return {"processed_data": {"extracted": state["raw_data"]}}

def transform_data(state: DataState):
    """데이터 변환"""
    data = state["processed_data"]
    return {"processed_data": {**data, "transformed": True}}

def validate_data(state: DataState):
    """데이터 검증"""
    return {"validation_status": "valid"}

# 서브그래프 빌더
data_builder = StateGraph(DataState)
data_builder.add_node("extract", extract_data)
data_builder.add_node("transform", transform_data)
data_builder.add_node("validate", validate_data)

data_builder.add_edge(START, "extract")
data_builder.add_edge("extract", "transform")
data_builder.add_edge("transform", "validate")
data_builder.add_edge("validate", END)

# 서브그래프 컴파일 (체크포인터 없이)
data_subgraph = data_builder.compile()
```

### 메인 그래프에 서브그래프 통합

```python
# 메인 그래프 상태
class MainState(TypedDict):
    messages: Annotated[list, add_messages]
    raw_data: str
    processed_data: dict
    validation_status: str
    final_result: str

def preprocessing_node(state: MainState):
    """전처리 노드"""
    # 서브그래프의 입력 준비
    return {"raw_data": state["messages"][-1].content}

def analysis_node(state: MainState):
    """분석 노드"""
    if state["validation_status"] == "valid":
        result = f"분석 완료: {state['processed_data']}"
    else:
        result = "데이터 검증 실패"
    return {"final_result": result}

# 메인 그래프 구성
main_builder = StateGraph(MainState)

main_builder.add_node("preprocess", preprocessing_node)
main_builder.add_node("data_pipeline", data_subgraph)  # 서브그래프를 노드로 추가
main_builder.add_node("analyze", analysis_node)

main_builder.add_edge(START, "preprocess")
main_builder.add_edge("preprocess", "data_pipeline")
main_builder.add_edge("data_pipeline", "analyze")
main_builder.add_edge("analyze", END)

# 메인 그래프 컴파일 (체크포인터는 여기서만)
main_graph = main_builder.compile(checkpointer=MemorySaver())
```

### 서브그래프 상태 관리

```python
# 서브그래프와 부모 그래프 간 상태 매핑
class ParentState(TypedDict):
    user_input: str
    sub_result: str
    messages: Annotated[list, add_messages]

class ChildState(TypedDict):
    input_data: str
    output_data: str

def call_subgraph(state: ParentState):
    """서브그래프 호출 및 상태 매핑"""
    # 부모 → 자식 상태 매핑
    child_input = {"input_data": state["user_input"]}

    # 서브그래프 실행
    child_result = child_subgraph.invoke(child_input)

    # 자식 → 부모 상태 매핑
    return {"sub_result": child_result["output_data"]}
```

## Hierarchical Teams (계층적 팀)

복잡한 조직 구조를 모델링합니다.

```python
# 팀 A: 연구팀
class ResearchTeamState(TypedDict):
    messages: Annotated[list, add_messages]
    research_topic: str
    findings: list

def literature_reviewer(state):
    """문헌 검토 에이전트"""
    return {"findings": state.get("findings", []) + ["문헌 검토 결과..."]}

def data_analyst(state):
    """데이터 분석 에이전트"""
    return {"findings": state.get("findings", []) + ["데이터 분석 결과..."]}

research_builder = StateGraph(ResearchTeamState)
research_builder.add_node("literature", literature_reviewer)
research_builder.add_node("analysis", data_analyst)
research_builder.add_edge(START, "literature")
research_builder.add_edge("literature", "analysis")
research_builder.add_edge("analysis", END)
research_team = research_builder.compile()

# 팀 B: 개발팀
class DevTeamState(TypedDict):
    messages: Annotated[list, add_messages]
    requirements: str
    code_output: str

def architect(state):
    """아키텍트 에이전트"""
    return {"code_output": "아키텍처 설계..."}

def developer(state):
    """개발자 에이전트"""
    return {"code_output": state.get("code_output", "") + "\n구현 코드..."}

dev_builder = StateGraph(DevTeamState)
dev_builder.add_node("architect", architect)
dev_builder.add_node("developer", developer)
dev_builder.add_edge(START, "architect")
dev_builder.add_edge("architect", "developer")
dev_builder.add_edge("developer", END)
dev_team = dev_builder.compile()

# 최상위 조직 그래프
class OrganizationState(TypedDict):
    messages: Annotated[list, add_messages]
    project_type: str
    research_topic: str
    requirements: str
    findings: list
    code_output: str

def project_manager(state: OrganizationState):
    """프로젝트 매니저: 팀 배정"""
    content = state["messages"][-1].content.lower()

    if "연구" in content or "분석" in content:
        return {"project_type": "research", "research_topic": content}
    else:
        return {"project_type": "development", "requirements": content}

def route_to_team(state: OrganizationState) -> str:
    return state["project_type"]

org_builder = StateGraph(OrganizationState)
org_builder.add_node("pm", project_manager)
org_builder.add_node("research_team", research_team)  # 팀을 노드로
org_builder.add_node("dev_team", dev_team)

org_builder.add_edge(START, "pm")
org_builder.add_conditional_edges("pm", route_to_team, {
    "research": "research_team",
    "development": "dev_team"
})
org_builder.add_edge("research_team", END)
org_builder.add_edge("dev_team", END)

organization = org_builder.compile(checkpointer=MemorySaver())
```

## 병렬 처리 (Parallel Execution)

여러 노드를 동시에 실행합니다.

### Fan-out / Fan-in 패턴

```python
from langgraph.constants import Send

class ParallelState(TypedDict):
    messages: Annotated[list, add_messages]
    topics: list[str]
    results: Annotated[list, lambda a, b: a + b]

def generate_topics(state: ParallelState):
    """주제 생성"""
    return {"topics": ["AI", "블록체인", "클라우드"]}

def research_topic(state: ParallelState):
    """개별 주제 연구 (병렬 실행)"""
    topic = state["topics"][0]  # 현재 주제
    # 연구 수행...
    return {"results": [f"{topic} 연구 결과"]}

def continue_to_research(state: ParallelState):
    """각 주제에 대해 병렬 노드 생성"""
    return [
        Send("research", {"topics": [topic], "results": []})
        for topic in state["topics"]
    ]

def aggregate_results(state: ParallelState):
    """결과 집계"""
    all_results = "\n".join(state["results"])
    return {"messages": [{"role": "assistant", "content": all_results}]}

builder = StateGraph(ParallelState)
builder.add_node("generate", generate_topics)
builder.add_node("research", research_topic)
builder.add_node("aggregate", aggregate_results)

builder.add_edge(START, "generate")
builder.add_conditional_edges("generate", continue_to_research)
builder.add_edge("research", "aggregate")
builder.add_edge("aggregate", END)

graph = builder.compile()
```

### Map-Reduce 패턴

```python
class MapReduceState(TypedDict):
    documents: list[str]
    summaries: Annotated[list, lambda a, b: a + b]
    final_summary: str

def map_summarize(state: MapReduceState):
    """각 문서 요약 (Map)"""
    doc = state["documents"][0]
    summary = llm.invoke(f"다음을 요약하세요: {doc}").content
    return {"summaries": [summary]}

def reduce_combine(state: MapReduceState):
    """요약 통합 (Reduce)"""
    combined = "\n".join(state["summaries"])
    final = llm.invoke(f"다음 요약들을 통합하세요: {combined}").content
    return {"final_summary": final}

def fan_out_docs(state: MapReduceState):
    """문서별 병렬 처리"""
    return [
        Send("map", {"documents": [doc], "summaries": []})
        for doc in state["documents"]
    ]
```

## 노드 캐싱

반복 계산을 피하기 위한 캐싱:

```python
from langgraph.cache import InMemoryCache

# 캐시 설정
cache = InMemoryCache()

def expensive_computation(state: State):
    """비용이 큰 계산"""
    # 이 노드의 결과가 캐시됨
    result = perform_heavy_calculation(state["input"])
    return {"output": result}

# 캐시와 함께 컴파일
graph = builder.compile(
    checkpointer=checkpointer,
    cache=cache
)
```

## 디버깅과 모니터링

### LangSmith 통합

```python
import os

# LangSmith 설정
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "your-api-key"
os.environ["LANGCHAIN_PROJECT"] = "my-langgraph-project"

# 자동으로 모든 실행이 LangSmith에 기록됨
result = graph.invoke({"messages": [...]})
```

### 커스텀 로깅

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("langgraph")

def logged_node(state: State):
    """로깅이 포함된 노드"""
    logger.info(f"노드 시작 - 입력 상태: {state}")

    try:
        result = process(state)
        logger.info(f"노드 완료 - 출력: {result}")
        return result
    except Exception as e:
        logger.error(f"노드 에러: {e}")
        raise
```

### 상태 스냅샷

```python
# 모든 체크포인트 조회
for checkpoint in graph.get_state_history(config):
    print(f"Step {checkpoint.metadata['step']}")
    print(f"  Timestamp: {checkpoint.metadata['created_at']}")
    print(f"  Node: {checkpoint.metadata.get('source')}")
    print(f"  State: {checkpoint.values}")
    print("---")
```

## 성능 최적화 팁

### 1. 배치 처리

```python
# 여러 입력을 배치로 처리
inputs = [
    {"messages": [{"role": "user", "content": "질문 1"}]},
    {"messages": [{"role": "user", "content": "질문 2"}]},
    {"messages": [{"role": "user", "content": "질문 3"}]},
]

# 병렬 실행
import asyncio

async def process_batch(inputs):
    tasks = [
        graph.ainvoke(inp, config={"configurable": {"thread_id": f"batch_{i}"}})
        for i, inp in enumerate(inputs)
    ]
    return await asyncio.gather(*tasks)

results = asyncio.run(process_batch(inputs))
```

### 2. 조건부 실행

```python
def should_skip_expensive_node(state: State) -> str:
    """비용이 큰 노드 건너뛰기"""
    if state.get("cached_result"):
        return "skip"
    return "execute"

builder.add_conditional_edges(
    "check",
    should_skip_expensive_node,
    {"skip": "next_node", "execute": "expensive_node"}
)
```

### 3. 재귀 제한 설정

```python
# 무한 루프 방지
result = graph.invoke(
    input_data,
    config={
        "configurable": {"thread_id": "session"},
        "recursion_limit": 50  # 최대 50번 반복
    }
)
```

## 다음 단계

고급 기능을 마스터했다면, [Real World 적용](./04-real-world.md)에서 다음을 학습하세요:

- **프로덕션 배포**: LangGraph Platform, Self-hosted
- **실제 사례 연구**: Uber, Elastic, Replit 등
- **아키텍처 패턴**: 실무 베스트 프랙티스

## 참고 자료

- [LangGraph Multi-Agent Workflows](https://blog.langchain.com/langgraph-multi-agent-workflows/)
- [Subgraph 가이드](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph-persistence/)
- [LangGraph Swarm](https://github.com/langchain-ai/langgraph-swarm-py)
