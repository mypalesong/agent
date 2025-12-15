---
sidebar_position: 2
title: LangGraph + AgentOps 통합 가이드
description: LangGraph로 프로덕션 레벨 AgentOps 시스템 구축하기
---

# LangGraph + AgentOps 통합 가이드

LangGraph는 AgentOps를 구현하기 위한 가장 강력한 프레임워크입니다. 이 가이드에서는 LangGraph의 핵심 기능을 활용하여 완전한 AgentOps 시스템을 구축하는 방법을 다룹니다.

## 왜 LangGraph인가?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AgentOps 요구사항과 LangGraph 매핑                         │
├─────────────────────────┬───────────────────────────────────────────────────┤
│    AgentOps 요구사항      │              LangGraph 솔루션                      │
├─────────────────────────┼───────────────────────────────────────────────────┤
│ 상태 추적 & 지속성       │ StateGraph + Checkpointer                         │
│ 분산 추적               │ LangSmith 통합 + 커스텀 트레이싱                    │
│ 에이전트 조율           │ Multi-Agent 워크플로우 + Supervisor 패턴           │
│ Human-in-the-loop      │ interrupt_before/after + update_state             │
│ 실시간 모니터링          │ Streaming + 이벤트 기반 아키텍처                   │
│ 비용 제어               │ 조건부 라우팅 + 모델 선택                          │
│ 장애 복구               │ 체크포인트 기반 재시작                             │
│ 평가 & 테스트           │ 구조화된 실행 흐름 + 재현 가능성                   │
└─────────────────────────┴───────────────────────────────────────────────────┘
```

## 아키텍처 설계

### AgentOps 전체 아키텍처

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         AgentOps Platform with LangGraph                        │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         Gateway Layer                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │   Auth &    │  │    Rate     │  │   Input     │  │   Request   │    │  │
│  │  │  API Keys   │  │   Limiter   │  │  Validator  │  │   Router    │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  └───────────────────────────────────┬─────────────────────────────────────┘  │
│                                      │                                         │
│  ┌───────────────────────────────────▼─────────────────────────────────────┐  │
│  │                    Orchestration Layer (LangGraph)                       │  │
│  │                                                                          │  │
│  │    ┌──────────────────────────────────────────────────────────────┐    │  │
│  │    │                    Supervisor Agent                           │    │  │
│  │    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │  │
│  │    │  │ Analyze │→│ Route   │→│ Execute │→│ Respond │         │    │  │
│  │    │  └─────────┘  └────┬────┘  └────┬────┘  └─────────┘         │    │  │
│  │    └────────────────────┼────────────┼────────────────────────────┘    │  │
│  │                         │            │                                  │  │
│  │    ┌────────────────────▼────────────▼────────────────────────────┐    │  │
│  │    │                  Specialist Agents                            │    │  │
│  │    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │    │  │
│  │    │  │ Research │  │  Coder   │  │  Writer  │  │ Analyst  │     │    │  │
│  │    │  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │     │    │  │
│  │    │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │    │  │
│  │    └──────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────┬─────────────────────────────────────┘  │
│                                      │                                         │
│  ┌───────────────────────────────────▼─────────────────────────────────────┐  │
│  │                    Infrastructure Layer                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ PostgreSQL  │  │   Redis     │  │  LangSmith  │  │ Prometheus  │    │  │
│  │  │ Checkpoints │  │   Cache     │  │   Tracing   │  │  Metrics    │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 핵심 구현

### 1. AgentOps 상태 정의

모든 운영 정보를 포함하는 상태 스키마:

```python
from typing import TypedDict, Annotated, Literal, Optional
from langgraph.graph.message import add_messages
from datetime import datetime
from dataclasses import dataclass, field

@dataclass
class OperationalMetrics:
    """운영 메트릭"""
    start_time: datetime = field(default_factory=datetime.now)
    total_tokens: int = 0
    total_cost: float = 0.0
    llm_calls: int = 0
    tool_calls: int = 0
    errors: list = field(default_factory=list)
    latencies: list = field(default_factory=list)

@dataclass
class TraceContext:
    """추적 컨텍스트"""
    trace_id: str = ""
    span_id: str = ""
    parent_span_id: str = ""
    baggage: dict = field(default_factory=dict)

class AgentOpsState(TypedDict):
    """AgentOps 통합 상태"""
    # 대화 상태
    messages: Annotated[list, add_messages]

    # 라우팅 상태
    current_agent: str
    next_agent: str
    task_queue: list[dict]

    # 운영 메트릭
    metrics: OperationalMetrics
    trace: TraceContext

    # Human-in-the-loop
    requires_approval: bool
    approval_reason: str
    approved: Optional[bool]

    # 가드레일
    guardrail_violations: list[str]
    risk_level: Literal["low", "medium", "high", "critical"]

    # 세션 정보
    session_id: str
    user_id: str
    environment: Literal["development", "staging", "production"]
```

### 2. 메트릭 수집 노드

모든 노드에서 자동으로 메트릭을 수집합니다:

```python
import time
import functools
from typing import Callable
from prometheus_client import Counter, Histogram, Gauge

# Prometheus 메트릭 정의
REQUEST_COUNTER = Counter(
    'agentops_requests_total',
    'Total requests processed',
    ['agent', 'action', 'status']
)

LATENCY_HISTOGRAM = Histogram(
    'agentops_latency_seconds',
    'Request latency',
    ['agent', 'action'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

TOKEN_COUNTER = Counter(
    'agentops_tokens_total',
    'Total tokens used',
    ['agent', 'model', 'type']
)

COST_COUNTER = Counter(
    'agentops_cost_dollars',
    'Total cost in dollars',
    ['agent', 'model']
)

ACTIVE_SESSIONS = Gauge(
    'agentops_active_sessions',
    'Number of active sessions'
)


def tracked_node(agent_name: str, action_name: str):
    """메트릭 추적 데코레이터"""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(state: AgentOpsState) -> dict:
            start_time = time.time()
            status = "success"

            try:
                # 노드 실행
                result = await func(state)

                # 토큰/비용 추적 (결과에 포함된 경우)
                if "token_usage" in result:
                    usage = result["token_usage"]
                    TOKEN_COUNTER.labels(
                        agent=agent_name,
                        model=usage.get("model", "unknown"),
                        type="input"
                    ).inc(usage.get("input_tokens", 0))
                    TOKEN_COUNTER.labels(
                        agent=agent_name,
                        model=usage.get("model", "unknown"),
                        type="output"
                    ).inc(usage.get("output_tokens", 0))

                    # 비용 계산
                    cost = calculate_cost(usage)
                    COST_COUNTER.labels(
                        agent=agent_name,
                        model=usage.get("model", "unknown")
                    ).inc(cost)

                    # 상태에 메트릭 누적
                    metrics = state.get("metrics", OperationalMetrics())
                    metrics.total_tokens += usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
                    metrics.total_cost += cost
                    metrics.llm_calls += 1
                    result["metrics"] = metrics

                return result

            except Exception as e:
                status = "error"
                # 에러 기록
                metrics = state.get("metrics", OperationalMetrics())
                metrics.errors.append({
                    "agent": agent_name,
                    "action": action_name,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                raise

            finally:
                # 레이턴시 기록
                latency = time.time() - start_time
                LATENCY_HISTOGRAM.labels(
                    agent=agent_name,
                    action=action_name
                ).observe(latency)
                REQUEST_COUNTER.labels(
                    agent=agent_name,
                    action=action_name,
                    status=status
                ).inc()

        return wrapper
    return decorator


def calculate_cost(usage: dict) -> float:
    """토큰 비용 계산"""
    pricing = {
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    }

    model = usage.get("model", "gpt-4o-mini")
    rates = pricing.get(model, {"input": 0.001, "output": 0.002})

    return (
        (usage.get("input_tokens", 0) / 1000) * rates["input"] +
        (usage.get("output_tokens", 0) / 1000) * rates["output"]
    )
```

### 3. 가드레일 노드

입출력 검증 및 안전성 체크:

```python
import re
from typing import Literal

class Guardrails:
    """AgentOps 가드레일 시스템"""

    # PII 패턴
    PII_PATTERNS = {
        "korean_ssn": r'\b\d{6}-\d{7}\b',
        "phone": r'\b\d{3}[-.\s]?\d{4}[-.\s]?\d{4}\b',
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
    }

    # 위험 키워드
    DANGEROUS_PATTERNS = [
        r'\b(rm|delete|drop|truncate)\s+(-rf?|database|table)\b',
        r'\b(sudo|chmod|chown)\b.*777',
        r'api[_-]?key|secret[_-]?key|password\s*[:=]',
    ]

    @classmethod
    def check_input(cls, text: str) -> tuple[bool, list[str]]:
        """입력 검증"""
        violations = []

        # PII 체크
        for pii_type, pattern in cls.PII_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"PII detected: {pii_type}")

        # 위험 패턴 체크
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"Dangerous pattern detected")

        return len(violations) == 0, violations

    @classmethod
    def check_output(cls, text: str) -> tuple[bool, list[str]]:
        """출력 검증"""
        violations = []

        # PII 유출 체크
        for pii_type, pattern in cls.PII_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"PII leakage: {pii_type}")

        return len(violations) == 0, violations

    @classmethod
    def assess_risk(cls, state: AgentOpsState) -> Literal["low", "medium", "high", "critical"]:
        """리스크 평가"""
        violations = state.get("guardrail_violations", [])
        metrics = state.get("metrics", OperationalMetrics())

        # 리스크 점수 계산
        risk_score = 0
        risk_score += len(violations) * 20
        risk_score += len(metrics.errors) * 15
        risk_score += min(metrics.total_cost * 10, 30)  # 비용 기반

        if risk_score >= 80:
            return "critical"
        elif risk_score >= 50:
            return "high"
        elif risk_score >= 20:
            return "medium"
        return "low"


@tracked_node("guardrails", "input_validation")
async def input_guardrail_node(state: AgentOpsState) -> dict:
    """입력 가드레일 노드"""
    last_message = state["messages"][-1].content

    is_valid, violations = Guardrails.check_input(last_message)

    if not is_valid:
        return {
            "guardrail_violations": state.get("guardrail_violations", []) + violations,
            "risk_level": "high",
            "requires_approval": True,
            "approval_reason": f"Input validation failed: {violations}"
        }

    return {"guardrail_violations": [], "risk_level": "low"}


@tracked_node("guardrails", "output_validation")
async def output_guardrail_node(state: AgentOpsState) -> dict:
    """출력 가드레일 노드"""
    last_message = state["messages"][-1].content

    is_valid, violations = Guardrails.check_output(last_message)

    if not is_valid:
        # 위반 시 출력 마스킹
        masked_output = mask_sensitive_data(last_message)
        return {
            "messages": [{"role": "assistant", "content": masked_output}],
            "guardrail_violations": state.get("guardrail_violations", []) + violations,
        }

    return {}


def mask_sensitive_data(text: str) -> str:
    """민감 데이터 마스킹"""
    for pattern in Guardrails.PII_PATTERNS.values():
        text = re.sub(pattern, "[REDACTED]", text, flags=re.IGNORECASE)
    return text
```

### 4. Supervisor Agent 구현

전체 에이전트 시스템을 조율하는 Supervisor:

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

SUPERVISOR_SYSTEM_PROMPT = """당신은 AI 에이전트 팀의 슈퍼바이저입니다.

## 역할
사용자 요청을 분석하고 적절한 전문 에이전트에게 작업을 위임합니다.

## 사용 가능한 에이전트
- researcher: 정보 검색, 리서치, 데이터 수집
- coder: 코드 작성, 디버깅, 기술 구현
- writer: 문서 작성, 콘텐츠 생성, 편집
- analyst: 데이터 분석, 인사이트 도출, 리포트 생성

## 라우팅 규칙
1. 작업의 주요 성격을 파악
2. 가장 적합한 에이전트 선택
3. 복잡한 작업은 여러 에이전트 순차 실행
4. 작업이 완료되면 FINISH 반환

## 응답 형식
다음 에이전트를 선택하고 이유를 설명하세요:
- next_agent: [researcher|coder|writer|analyst|FINISH]
- reason: 선택 이유
- task_description: 에이전트에게 전달할 작업 설명
"""

@tracked_node("supervisor", "route")
async def supervisor_node(state: AgentOpsState) -> dict:
    """슈퍼바이저 노드: 작업 라우팅"""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # 현재 상태 요약
    context = f"""
    현재 상태:
    - 완료된 에이전트: {state.get('completed_agents', [])}
    - 누적 비용: ${state.get('metrics', OperationalMetrics()).total_cost:.4f}
    - 에러 수: {len(state.get('metrics', OperationalMetrics()).errors)}
    """

    messages = [
        SystemMessage(content=SUPERVISOR_SYSTEM_PROMPT),
        HumanMessage(content=context),
        *state["messages"]
    ]

    response = await llm.ainvoke(messages)

    # 응답 파싱
    content = response.content.lower()

    if "researcher" in content:
        next_agent = "researcher"
    elif "coder" in content:
        next_agent = "coder"
    elif "writer" in content:
        next_agent = "writer"
    elif "analyst" in content:
        next_agent = "analyst"
    else:
        next_agent = "FINISH"

    return {
        "next_agent": next_agent,
        "current_agent": "supervisor",
        "messages": [response],
        "token_usage": {
            "model": "gpt-4o-mini",
            "input_tokens": response.usage_metadata.get("input_tokens", 0),
            "output_tokens": response.usage_metadata.get("output_tokens", 0),
        }
    }


def route_to_agent(state: AgentOpsState) -> str:
    """라우팅 결정"""
    next_agent = state.get("next_agent", "FINISH")

    # 비용 제한 체크
    metrics = state.get("metrics", OperationalMetrics())
    if metrics.total_cost > 1.0:  # $1 제한
        return "cost_limit_exceeded"

    # 승인 필요 체크
    if state.get("requires_approval") and not state.get("approved"):
        return "needs_approval"

    return next_agent
```

### 5. 전문 에이전트 구현

각 전문 분야 에이전트:

```python
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

# 도구 정의
@tool
def web_search(query: str) -> str:
    """웹 검색을 수행합니다."""
    # 실제 구현에서는 검색 API 호출
    return f"'{query}' 검색 결과..."

@tool
def read_file(path: str) -> str:
    """파일을 읽습니다."""
    return f"파일 내용: {path}"

@tool
def write_file(path: str, content: str) -> str:
    """파일에 씁니다."""
    return f"파일 작성 완료: {path}"

@tool
def execute_code(code: str, language: str = "python") -> str:
    """코드를 실행합니다."""
    return f"코드 실행 결과..."

@tool
def analyze_data(data: str, analysis_type: str) -> str:
    """데이터를 분석합니다."""
    return f"{analysis_type} 분석 결과..."


# 에이전트 정의
AGENT_CONFIGS = {
    "researcher": {
        "system_prompt": "당신은 전문 리서처입니다. 정보를 검색하고 정리합니다.",
        "tools": [web_search, read_file],
        "model": "gpt-4o-mini",
    },
    "coder": {
        "system_prompt": "당신은 전문 개발자입니다. 코드를 작성하고 디버깅합니다.",
        "tools": [read_file, write_file, execute_code],
        "model": "gpt-4o",  # 코딩은 더 강력한 모델 사용
    },
    "writer": {
        "system_prompt": "당신은 전문 작가입니다. 문서를 작성하고 편집합니다.",
        "tools": [read_file, write_file],
        "model": "gpt-4o-mini",
    },
    "analyst": {
        "system_prompt": "당신은 데이터 분석가입니다. 데이터를 분석하고 인사이트를 도출합니다.",
        "tools": [read_file, analyze_data],
        "model": "gpt-4o-mini",
    },
}


def create_specialist_node(agent_name: str):
    """전문 에이전트 노드 생성"""
    config = AGENT_CONFIGS[agent_name]

    @tracked_node(agent_name, "execute")
    async def specialist_node(state: AgentOpsState) -> dict:
        llm = ChatOpenAI(
            model=config["model"],
            temperature=0.7
        ).bind_tools(config["tools"])

        messages = [
            SystemMessage(content=config["system_prompt"]),
            *state["messages"]
        ]

        response = await llm.ainvoke(messages)

        return {
            "messages": [response],
            "current_agent": agent_name,
            "token_usage": {
                "model": config["model"],
                "input_tokens": response.usage_metadata.get("input_tokens", 0),
                "output_tokens": response.usage_metadata.get("output_tokens", 0),
            }
        }

    return specialist_node

# 각 에이전트 노드 생성
researcher_node = create_specialist_node("researcher")
coder_node = create_specialist_node("coder")
writer_node = create_specialist_node("writer")
analyst_node = create_specialist_node("analyst")

# 도구 노드
all_tools = [web_search, read_file, write_file, execute_code, analyze_data]
tools_node = ToolNode(all_tools)
```

### 6. 완전한 AgentOps 그래프

모든 구성요소를 통합한 그래프:

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.memory import MemorySaver

def build_agentops_graph(checkpointer=None):
    """AgentOps 그래프 빌드"""

    builder = StateGraph(AgentOpsState)

    # 노드 추가
    builder.add_node("input_guardrail", input_guardrail_node)
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("writer", writer_node)
    builder.add_node("analyst", analyst_node)
    builder.add_node("tools", tools_node)
    builder.add_node("output_guardrail", output_guardrail_node)

    # Human-in-the-loop 노드
    builder.add_node("approval_gate", lambda s: s)  # 패스스루

    # 엣지 구성
    builder.add_edge(START, "input_guardrail")

    # 입력 가드레일 → 슈퍼바이저 또는 승인 대기
    builder.add_conditional_edges(
        "input_guardrail",
        lambda s: "approval_gate" if s.get("requires_approval") else "supervisor",
        {"approval_gate": "approval_gate", "supervisor": "supervisor"}
    )

    # 승인 게이트 → 슈퍼바이저 (승인 후)
    builder.add_edge("approval_gate", "supervisor")

    # 슈퍼바이저 라우팅
    builder.add_conditional_edges(
        "supervisor",
        route_to_agent,
        {
            "researcher": "researcher",
            "coder": "coder",
            "writer": "writer",
            "analyst": "analyst",
            "FINISH": "output_guardrail",
            "needs_approval": "approval_gate",
            "cost_limit_exceeded": "output_guardrail",
        }
    )

    # 전문 에이전트 → 도구 또는 슈퍼바이저
    for agent in ["researcher", "coder", "writer", "analyst"]:
        builder.add_conditional_edges(
            agent,
            lambda s: "tools" if s["messages"][-1].tool_calls else "supervisor",
            {"tools": "tools", "supervisor": "supervisor"}
        )

    # 도구 → 해당 에이전트로 복귀
    builder.add_conditional_edges(
        "tools",
        lambda s: s.get("current_agent", "supervisor"),
        {
            "researcher": "researcher",
            "coder": "coder",
            "writer": "writer",
            "analyst": "analyst",
            "supervisor": "supervisor",
        }
    )

    # 출력 가드레일 → 종료
    builder.add_edge("output_guardrail", END)

    # 체크포인터 설정 (프로덕션: PostgreSQL, 개발: Memory)
    if checkpointer is None:
        checkpointer = MemorySaver()

    # 승인 게이트에서 인터럽트
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["approval_gate"]
    )


# 그래프 생성
graph = build_agentops_graph()
```

## 그래프 시각화

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   input_guardrail    │
                └──────────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌─────────────────┐      ┌─────────────────┐
    │  approval_gate  │◄─────│   supervisor    │
    │  (interrupt)    │      └────────┬────────┘
    └────────┬────────┘               │
             │            ┌───────────┼───────────┬───────────┐
             │            │           │           │           │
             └────────────▼           ▼           ▼           ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │researcher│ │  coder   │ │  writer  │ │ analyst  │
                    └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
                         │            │            │            │
                         └────────────┼────────────┼────────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │    tools     │
                              └──────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │   output_guardrail   │
                           └──────────┬───────────┘
                                      │
                                      ▼
                               ┌───────────┐
                               │    END    │
                               └───────────┘
```

## 실행 및 운영

### 기본 실행

```python
import asyncio

async def run_agentops():
    """AgentOps 시스템 실행"""

    config = {
        "configurable": {
            "thread_id": "session_001",
            "user_id": "user_123",
        }
    }

    # 사용자 요청
    result = await graph.ainvoke(
        {
            "messages": [{"role": "user", "content": "최신 AI 트렌드를 조사하고 보고서를 작성해줘"}],
            "metrics": OperationalMetrics(),
            "session_id": "session_001",
            "user_id": "user_123",
            "environment": "production",
        },
        config=config
    )

    # 결과 출력
    print(f"응답: {result['messages'][-1].content}")
    print(f"총 비용: ${result['metrics'].total_cost:.4f}")
    print(f"총 토큰: {result['metrics'].total_tokens}")

asyncio.run(run_agentops())
```

### 승인 워크플로우

```python
async def run_with_approval():
    """승인이 필요한 워크플로우"""

    config = {"configurable": {"thread_id": "approval_session"}}

    # 1단계: 실행 (승인 대기에서 멈춤)
    result = await graph.ainvoke(
        {
            "messages": [{"role": "user", "content": "주민등록번호 123456-1234567로 조회해줘"}],
            "metrics": OperationalMetrics(),
        },
        config=config
    )

    # 현재 상태 확인
    state = await graph.aget_state(config)
    print(f"대기 이유: {state.values.get('approval_reason')}")
    print(f"위반 사항: {state.values.get('guardrail_violations')}")

    # 관리자 승인/거부
    user_decision = input("승인하시겠습니까? (yes/no): ")

    if user_decision == "yes":
        # 승인 후 계속
        await graph.aupdate_state(config, {"approved": True})
        result = await graph.ainvoke(None, config=config)
    else:
        # 거부 - 상태 수정
        await graph.aupdate_state(
            config,
            {
                "messages": [{"role": "assistant", "content": "요청이 보안 정책에 의해 거부되었습니다."}],
                "approved": False,
            }
        )
```

### 스트리밍 실행

```python
async def run_with_streaming():
    """실시간 스트리밍"""

    config = {"configurable": {"thread_id": "stream_session"}}

    async for event in graph.astream_events(
        {
            "messages": [{"role": "user", "content": "파이썬 웹 스크래퍼 코드 작성해줘"}],
            "metrics": OperationalMetrics(),
        },
        config=config,
        version="v2"
    ):
        kind = event["event"]

        if kind == "on_chain_start":
            print(f"🔄 노드 시작: {event['name']}")

        elif kind == "on_chain_end":
            print(f"✅ 노드 완료: {event['name']}")

        elif kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                print(content, end="", flush=True)

        elif kind == "on_tool_start":
            print(f"\n🔧 도구 시작: {event['name']}")

        elif kind == "on_tool_end":
            print(f"🔧 도구 완료: {event['name']}")
```

## 다음 단계

- [실전 구현 가이드](./03-implementation-guide.md): 단계별 프로젝트 구현
- [코드 템플릿](./04-templates.md): 바로 사용 가능한 템플릿
- [프로덕션 배포](./05-deployment.md): 배포 및 운영 가이드
