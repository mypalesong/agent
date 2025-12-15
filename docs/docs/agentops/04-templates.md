---
sidebar_position: 4
title: 코드 템플릿
description: 바로 사용 가능한 AgentOps 코드 템플릿 모음
---

# AgentOps 코드 템플릿

복사해서 바로 사용할 수 있는 프로덕션 레디 템플릿 모음입니다.

## 빠른 시작 템플릿

### 1. 기본 AgentOps 설정

```python
# quick_start.py
"""
AgentOps 빠른 시작 템플릿
바로 실행 가능한 최소 설정
"""

import asyncio
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

# 1. 상태 정의
class State(TypedDict):
    messages: Annotated[list, add_messages]
    current_agent: str

# 2. 에이전트 설정
llm = ChatOpenAI(model="gpt-4o-mini")

async def agent_node(state: State) -> dict:
    """메인 에이전트"""
    messages = [
        SystemMessage(content="당신은 유용한 AI 어시스턴트입니다."),
        *state["messages"]
    ]
    response = await llm.ainvoke(messages)
    return {"messages": [response], "current_agent": "main"}

# 3. 그래프 구성
builder = StateGraph(State)
builder.add_node("agent", agent_node)
builder.add_edge(START, "agent")
builder.add_edge("agent", END)

graph = builder.compile(checkpointer=MemorySaver())

# 4. 실행
async def main():
    result = await graph.ainvoke(
        {"messages": [{"role": "user", "content": "안녕하세요!"}]},
        config={"configurable": {"thread_id": "session_1"}}
    )
    print(result["messages"][-1].content)

if __name__ == "__main__":
    asyncio.run(main())
```

### 2. 도구가 있는 에이전트

```python
# agent_with_tools.py
"""
도구 호출이 가능한 에이전트 템플릿
"""

import asyncio
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage

# 1. 도구 정의
@tool
def calculator(expression: str) -> str:
    """수학 계산을 수행합니다. 예: '2 + 2', '10 * 5'"""
    try:
        result = eval(expression)
        return f"계산 결과: {result}"
    except:
        return "계산할 수 없는 표현식입니다."

@tool
def get_current_time() -> str:
    """현재 시간을 반환합니다."""
    from datetime import datetime
    return f"현재 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

tools = [calculator, get_current_time]

# 2. 상태 정의
class State(TypedDict):
    messages: Annotated[list, add_messages]

# 3. 에이전트 설정
llm = ChatOpenAI(model="gpt-4o-mini").bind_tools(tools)

async def agent_node(state: State) -> dict:
    messages = [
        SystemMessage(content="당신은 계산과 시간 조회가 가능한 어시스턴트입니다."),
        *state["messages"]
    ]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}

def should_continue(state: State) -> str:
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"

# 4. 그래프 구성
builder = StateGraph(State)
builder.add_node("agent", agent_node)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
builder.add_edge("tools", "agent")

graph = builder.compile(checkpointer=MemorySaver())

# 5. 실행
async def main():
    result = await graph.ainvoke(
        {"messages": [{"role": "user", "content": "123 * 456 계산해줘"}]},
        config={"configurable": {"thread_id": "calc_session"}}
    )
    print(result["messages"][-1].content)

if __name__ == "__main__":
    asyncio.run(main())
```

## Multi-Agent 템플릿

### 3. Supervisor 패턴

```python
# supervisor_pattern.py
"""
Supervisor 패턴 멀티-에이전트 템플릿
슈퍼바이저가 작업을 전문 에이전트에게 위임
"""

import asyncio
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# 상태 정의
class MultiAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    next_agent: str
    completed_agents: list[str]

# 에이전트 정의
AGENTS = {
    "researcher": {
        "prompt": "당신은 리서처입니다. 정보를 조사하고 분석합니다.",
        "model": "gpt-4o-mini"
    },
    "coder": {
        "prompt": "당신은 개발자입니다. 코드를 작성하고 설명합니다.",
        "model": "gpt-4o"
    },
    "writer": {
        "prompt": "당신은 작가입니다. 문서와 보고서를 작성합니다.",
        "model": "gpt-4o-mini"
    }
}

# 슈퍼바이저
SUPERVISOR_PROMPT = """당신은 팀 슈퍼바이저입니다.
사용자 요청을 분석하고 적절한 에이전트를 선택하세요.

사용 가능: researcher, coder, writer
작업 완료 시: FINISH

응답 형식:
NEXT: [에이전트명 또는 FINISH]
"""

async def supervisor_node(state: MultiAgentState) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    completed = state.get("completed_agents", [])
    context = f"완료된 에이전트: {completed}" if completed else ""

    messages = [
        SystemMessage(content=SUPERVISOR_PROMPT + context),
        *state["messages"]
    ]

    response = await llm.ainvoke(messages)
    content = response.content.lower()

    # 파싱
    if "researcher" in content:
        next_agent = "researcher"
    elif "coder" in content:
        next_agent = "coder"
    elif "writer" in content:
        next_agent = "writer"
    else:
        next_agent = "FINISH"

    return {"messages": [response], "next_agent": next_agent}


def create_agent_node(agent_name: str):
    """에이전트 노드 팩토리"""
    config = AGENTS[agent_name]

    async def node(state: MultiAgentState) -> dict:
        llm = ChatOpenAI(model=config["model"])
        messages = [
            SystemMessage(content=config["prompt"]),
            *state["messages"]
        ]
        response = await llm.ainvoke(messages)

        completed = state.get("completed_agents", [])
        return {
            "messages": [response],
            "completed_agents": completed + [agent_name]
        }

    return node


def route_supervisor(state: MultiAgentState) -> str:
    return state.get("next_agent", "FINISH")


# 그래프 구성
builder = StateGraph(MultiAgentState)

builder.add_node("supervisor", supervisor_node)
for name in AGENTS:
    builder.add_node(name, create_agent_node(name))

builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    route_supervisor,
    {**{name: name for name in AGENTS}, "FINISH": END}
)

for name in AGENTS:
    builder.add_edge(name, "supervisor")

graph = builder.compile(checkpointer=MemorySaver())


async def main():
    result = await graph.ainvoke(
        {"messages": [{"role": "user", "content": "파이썬으로 웹 스크래퍼 만들어줘"}]},
        config={"configurable": {"thread_id": "multi_agent_1"}}
    )

    print("=== 최종 결과 ===")
    print(result["messages"][-1].content)
    print(f"\n실행된 에이전트: {result.get('completed_agents', [])}")


if __name__ == "__main__":
    asyncio.run(main())
```

### 4. Human-in-the-Loop 템플릿

```python
# human_in_loop.py
"""
Human-in-the-Loop 템플릿
중요한 결정에서 인간 승인을 받는 워크플로우
"""

import asyncio
from typing import TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

# 상태 정의
class ApprovalState(TypedDict):
    messages: Annotated[list, add_messages]
    action: str
    risk_level: str
    requires_approval: bool
    approved: Optional[bool]
    approval_reason: str

# 위험 분류기
async def risk_classifier(state: ApprovalState) -> dict:
    """요청의 위험 수준 분류"""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    prompt = """사용자 요청의 위험 수준을 분류하세요.

위험 수준:
- low: 정보 조회, 일반 질문
- medium: 파일 수정, 설정 변경
- high: 금융 거래, 데이터 삭제, 외부 API 호출

응답 형식:
RISK: [low|medium|high]
ACTION: [수행할 작업 설명]
"""

    messages = [SystemMessage(content=prompt), *state["messages"]]
    response = await llm.ainvoke(messages)
    content = response.content.lower()

    # 파싱
    if "high" in content:
        risk_level = "high"
        requires_approval = True
    elif "medium" in content:
        risk_level = "medium"
        requires_approval = True
    else:
        risk_level = "low"
        requires_approval = False

    return {
        "messages": [response],
        "risk_level": risk_level,
        "requires_approval": requires_approval,
        "approval_reason": f"위험 수준: {risk_level}"
    }


async def approval_gate(state: ApprovalState) -> dict:
    """승인 게이트 (패스스루)"""
    return {}


async def execute_action(state: ApprovalState) -> dict:
    """작업 실행"""
    llm = ChatOpenAI(model="gpt-4o-mini")

    if state.get("approved") == False:
        return {
            "messages": [{"role": "assistant", "content": "작업이 사용자에 의해 거부되었습니다."}]
        }

    messages = [
        SystemMessage(content="요청된 작업을 수행하세요."),
        *state["messages"]
    ]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}


def route_after_classification(state: ApprovalState) -> str:
    if state.get("requires_approval"):
        return "approval"
    return "execute"


def route_after_approval(state: ApprovalState) -> str:
    if state.get("approved"):
        return "execute"
    return "execute"  # 거부 메시지도 execute에서 처리


# 그래프 구성
builder = StateGraph(ApprovalState)

builder.add_node("classify", risk_classifier)
builder.add_node("approval", approval_gate)
builder.add_node("execute", execute_action)

builder.add_edge(START, "classify")
builder.add_conditional_edges(
    "classify",
    route_after_classification,
    {"approval": "approval", "execute": "execute"}
)
builder.add_edge("approval", "execute")
builder.add_edge("execute", END)

graph = builder.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["approval"]
)


async def main():
    config = {"configurable": {"thread_id": "approval_demo"}}

    # 1단계: 실행 (승인이 필요하면 멈춤)
    result = await graph.ainvoke(
        {"messages": [{"role": "user", "content": "내 계좌에서 100만원 송금해줘"}]},
        config=config
    )

    # 상태 확인
    state = await graph.aget_state(config)

    if state.next:  # 다음 노드가 있으면 인터럽트된 것
        print(f"⚠️ 승인 필요!")
        print(f"위험 수준: {state.values.get('risk_level')}")
        print(f"이유: {state.values.get('approval_reason')}")

        # 사용자 입력
        approval = input("\n승인하시겠습니까? (yes/no): ")

        # 상태 업데이트
        await graph.aupdate_state(
            config,
            {"approved": approval.lower() == "yes"}
        )

        # 계속 실행
        result = await graph.ainvoke(None, config=config)

    print(f"\n결과: {result['messages'][-1].content}")


if __name__ == "__main__":
    asyncio.run(main())
```

## 운영 템플릿

### 5. 메트릭 수집 템플릿

```python
# metrics_template.py
"""
Prometheus 메트릭 수집 템플릿
"""

import time
import functools
from typing import Callable
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# 메트릭 정의
class AgentMetrics:
    """에이전트 메트릭"""

    requests = Counter(
        'agent_requests_total',
        '총 요청 수',
        ['agent', 'status']
    )

    latency = Histogram(
        'agent_latency_seconds',
        '요청 레이턴시',
        ['agent'],
        buckets=[0.1, 0.5, 1, 2, 5, 10, 30]
    )

    tokens = Counter(
        'agent_tokens_total',
        '총 토큰 사용량',
        ['agent', 'model', 'type']
    )

    cost = Counter(
        'agent_cost_dollars',
        '총 비용 (USD)',
        ['agent', 'model']
    )

    active_sessions = Gauge(
        'agent_active_sessions',
        '활성 세션 수'
    )

    errors = Counter(
        'agent_errors_total',
        '에러 수',
        ['agent', 'error_type']
    )


def track_metrics(agent_name: str):
    """메트릭 추적 데코레이터"""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            status = "success"

            try:
                result = await func(*args, **kwargs)

                # 토큰 추적
                if "token_usage" in result:
                    usage = result["token_usage"]
                    AgentMetrics.tokens.labels(
                        agent=agent_name,
                        model=usage.get("model", "unknown"),
                        type="input"
                    ).inc(usage.get("input_tokens", 0))

                    AgentMetrics.tokens.labels(
                        agent=agent_name,
                        model=usage.get("model", "unknown"),
                        type="output"
                    ).inc(usage.get("output_tokens", 0))

                return result

            except Exception as e:
                status = "error"
                AgentMetrics.errors.labels(
                    agent=agent_name,
                    error_type=type(e).__name__
                ).inc()
                raise

            finally:
                duration = time.time() - start
                AgentMetrics.latency.labels(agent=agent_name).observe(duration)
                AgentMetrics.requests.labels(agent=agent_name, status=status).inc()

        return wrapper
    return decorator


# 사용 예시
@track_metrics("my_agent")
async def my_agent_node(state):
    # 에이전트 로직
    pass


# 메트릭 서버 시작
def start_metrics_server(port: int = 9090):
    start_http_server(port)
    print(f"메트릭 서버 시작: http://localhost:{port}/metrics")
```

### 6. 가드레일 템플릿

```python
# guardrails_template.py
"""
완전한 가드레일 시스템 템플릿
"""

import re
from dataclasses import dataclass
from typing import Optional
from enum import Enum

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ValidationResult:
    passed: bool
    violations: list[str]
    risk_level: RiskLevel
    requires_approval: bool = False
    sanitized_content: Optional[str] = None


class Guardrails:
    """통합 가드레일 시스템"""

    # PII 패턴
    PII_PATTERNS = {
        "ssn_kr": (r'\d{6}-[1-4]\d{6}', "주민등록번호"),
        "phone_kr": (r'01[0-9]-?\d{4}-?\d{4}', "전화번호"),
        "email": (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', "이메일"),
        "credit_card": (r'\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}', "신용카드"),
    }

    # 위험 명령 패턴
    DANGEROUS_COMMANDS = [
        (r'rm\s+-rf', "위험한 삭제"),
        (r'DROP\s+TABLE', "DB 테이블 삭제"),
        (r'DELETE\s+FROM.*WHERE\s+1\s*=\s*1', "전체 삭제"),
        (r'sudo\s+', "권한 상승"),
    ]

    # 프롬프트 인젝션 패턴
    INJECTION_PATTERNS = [
        (r'ignore\s+(all\s+)?previous\s+instructions?', "프롬프트 인젝션"),
        (r'you\s+are\s+now\s+', "역할 변경"),
        (r'act\s+as\s+(if\s+)?you', "행동 변경"),
    ]

    @classmethod
    def validate_input(cls, text: str) -> ValidationResult:
        """입력 검증"""
        violations = []
        risk_level = RiskLevel.LOW

        # PII 검사
        for name, (pattern, desc) in cls.PII_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"PII 감지: {desc}")
                risk_level = max(risk_level, RiskLevel.HIGH, key=lambda x: x.value)

        # 위험 명령 검사
        for pattern, desc in cls.DANGEROUS_COMMANDS:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"위험 명령: {desc}")
                risk_level = RiskLevel.CRITICAL

        # 인젝션 검사
        for pattern, desc in cls.INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"보안 위협: {desc}")
                risk_level = RiskLevel.CRITICAL

        return ValidationResult(
            passed=len(violations) == 0,
            violations=violations,
            risk_level=risk_level,
            requires_approval=risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        )

    @classmethod
    def validate_output(cls, text: str) -> ValidationResult:
        """출력 검증"""
        violations = []

        # PII 유출 검사
        for name, (pattern, desc) in cls.PII_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"PII 유출: {desc}")

        # 민감 정보 패턴
        sensitive = [
            (r'api[_-]?key\s*[:=]\s*\S+', "API 키"),
            (r'password\s*[:=]\s*\S+', "비밀번호"),
            (r'secret\s*[:=]\s*\S+', "시크릿"),
            (r'token\s*[:=]\s*\S+', "토큰"),
        ]

        for pattern, desc in sensitive:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"민감정보 노출: {desc}")

        sanitized = cls.sanitize(text) if violations else None

        return ValidationResult(
            passed=len(violations) == 0,
            violations=violations,
            risk_level=RiskLevel.HIGH if violations else RiskLevel.LOW,
            sanitized_content=sanitized
        )

    @classmethod
    def sanitize(cls, text: str) -> str:
        """민감 정보 마스킹"""
        result = text

        # PII 마스킹
        for name, (pattern, _) in cls.PII_PATTERNS.items():
            result = re.sub(pattern, "[REDACTED]", result, flags=re.IGNORECASE)

        # 시크릿 마스킹
        result = re.sub(
            r'(api[_-]?key|password|secret|token)\s*[:=]\s*\S+',
            r'\1=[REDACTED]',
            result,
            flags=re.IGNORECASE
        )

        return result


# LangGraph 노드로 사용
async def input_guardrail_node(state):
    """입력 가드레일 노드"""
    last_message = state["messages"][-1].content
    result = Guardrails.validate_input(last_message)

    return {
        "guardrail_passed": result.passed,
        "guardrail_violations": result.violations,
        "risk_level": result.risk_level.value,
        "requires_approval": result.requires_approval,
    }


async def output_guardrail_node(state):
    """출력 가드레일 노드"""
    last_message = state["messages"][-1].content
    result = Guardrails.validate_output(last_message)

    if result.sanitized_content:
        return {
            "messages": [{"role": "assistant", "content": result.sanitized_content}],
            "output_sanitized": True,
        }

    return {"output_sanitized": False}
```

### 7. 스트리밍 템플릿

```python
# streaming_template.py
"""
실시간 스트리밍 템플릿
"""

import asyncio
from typing import TypedDict, Annotated, AsyncGenerator
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI


class State(TypedDict):
    messages: Annotated[list, add_messages]


async def stream_agent_response(
    graph,
    user_message: str,
    session_id: str
) -> AsyncGenerator[dict, None]:
    """
    에이전트 응답을 스트리밍으로 반환

    Yields:
        dict: 이벤트 정보
            - type: 이벤트 타입 (node_start, node_end, token, tool_start, tool_end)
            - data: 이벤트 데이터
    """

    config = {"configurable": {"thread_id": session_id}}

    async for event in graph.astream_events(
        {"messages": [{"role": "user", "content": user_message}]},
        config=config,
        version="v2"
    ):
        kind = event["event"]

        if kind == "on_chain_start":
            name = event.get("name", "")
            if name and name not in ["RunnableSequence", "ChannelWrite"]:
                yield {"type": "node_start", "data": {"node": name}}

        elif kind == "on_chain_end":
            name = event.get("name", "")
            if name and name not in ["RunnableSequence", "ChannelWrite"]:
                yield {"type": "node_end", "data": {"node": name}}

        elif kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                yield {"type": "token", "data": {"content": content}}

        elif kind == "on_tool_start":
            yield {
                "type": "tool_start",
                "data": {
                    "tool": event["name"],
                    "input": event["data"].get("input", {})
                }
            }

        elif kind == "on_tool_end":
            yield {
                "type": "tool_end",
                "data": {
                    "tool": event["name"],
                    "output": event["data"].get("output", "")
                }
            }


# 사용 예시: 콘솔 출력
async def print_stream(graph, message: str, session_id: str):
    """스트리밍 결과를 콘솔에 출력"""

    async for event in stream_agent_response(graph, message, session_id):
        event_type = event["type"]
        data = event["data"]

        if event_type == "node_start":
            print(f"\n🔄 {data['node']} 시작...")

        elif event_type == "node_end":
            print(f"✅ {data['node']} 완료")

        elif event_type == "token":
            print(data["content"], end="", flush=True)

        elif event_type == "tool_start":
            print(f"\n🔧 도구 호출: {data['tool']}")

        elif event_type == "tool_end":
            print(f"🔧 도구 결과: {data['output'][:100]}...")


# 사용 예시: FastAPI 엔드포인트
"""
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        async for event in stream_agent_response(
            graph,
            request.message,
            request.session_id
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
"""
```

## Docker & Kubernetes 템플릿

### 8. Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드
COPY src/ ./src/

# 환경 변수
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 포트
EXPOSE 8000 9090

# 실행
CMD ["python", "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 9. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentops
  labels:
    app: agentops
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentops
  template:
    metadata:
      labels:
        app: agentops
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
      - name: agentops
        image: agentops:latest
        ports:
        - containerPort: 8000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: agentops-secrets
              key: openai-api-key
        - name: ENVIRONMENT
          value: "production"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: agentops-service
spec:
  selector:
    app: agentops
  ports:
  - name: http
    port: 80
    targetPort: 8000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentops-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentops
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 다음 단계

- [프로덕션 배포 가이드](./05-deployment.md)
- [LangGraph 기초](../langgraph/01-beginner.md)
- [LangGraph 고급](../langgraph/03-advanced.md)
