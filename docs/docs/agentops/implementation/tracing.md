---
sidebar_position: 1
title: "분산 추적 구현"
description: "OpenTelemetry 기반 에이전트 분산 추적 구현 가이드"
---

# 분산 추적 구현 가이드

OpenTelemetry를 사용하여 AI 에이전트의 모든 행동을 추적하는 방법을 설명합니다.

---

## 1. 개요

### 1.1 왜 에이전트 추적이 중요한가?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Why Agent Tracing Matters                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  기존 애플리케이션 추적          에이전트 추적의 추가 요구사항           │
│                                                                          │
│  ✓ HTTP 요청/응답               ✓ 추론 과정 (Chain of Thought)           │
│  ✓ 데이터베이스 쿼리            ✓ LLM API 호출 (토큰, 비용)             │
│  ✓ 외부 API 호출                ✓ 도구 선택 및 실행                      │
│  ✓ 메시지 큐 처리               ✓ 에이전트 간 위임                       │
│                                  ✓ 메모리 접근 및 검색                   │
│                                  ✓ 가드레일 검사                         │
│                                  ✓ 의사 결정 지점                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 추적 아키텍처

```
Agent Application          OTEL Collector          Backend
┌─────────────────┐       ┌─────────────────┐    ┌──────────────┐
│                 │       │                 │    │              │
│ ┌─────────────┐ │ OTLP  │ ┌─────────────┐ │    │   Jaeger/    │
│ │ Agent SDK   │─┼──────▶│ │  Receiver   │ │───▶│   Tempo/     │
│ │ (Tracer)    │ │       │ └──────┬──────┘ │    │   Zipkin     │
│ └─────────────┘ │       │        │        │    │              │
│                 │       │ ┌──────▼──────┐ │    └──────────────┘
│ ┌─────────────┐ │       │ │ Processors  │ │
│ │ Auto-       │ │       │ │ - Batch     │ │    ┌──────────────┐
│ │ Instrument  │ │       │ │ - Sample    │ │    │              │
│ └─────────────┘ │       │ │ - Enrich    │ │───▶│  ClickHouse  │
│                 │       │ └──────┬──────┘ │    │  (Analytics) │
└─────────────────┘       │        │        │    │              │
                          │ ┌──────▼──────┐ │    └──────────────┘
                          │ │  Exporters  │ │
                          │ └─────────────┘ │
                          └─────────────────┘
```

---

## 2. 설정

### 2.1 의존성 설치

```bash
# Python
pip install opentelemetry-api \
            opentelemetry-sdk \
            opentelemetry-exporter-otlp \
            opentelemetry-instrumentation-aiohttp \
            opentelemetry-instrumentation-redis \
            opentelemetry-instrumentation-sqlalchemy

# Node.js
npm install @opentelemetry/api \
            @opentelemetry/sdk-trace-node \
            @opentelemetry/exporter-trace-otlp-grpc \
            @opentelemetry/instrumentation-http
```

### 2.2 기본 설정

```python
# agentops/tracing/setup.py

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat

def setup_tracing(
    service_name: str,
    service_version: str,
    otlp_endpoint: str = "http://localhost:4317",
    sampling_rate: float = 1.0
):
    """
    OpenTelemetry 추적 설정

    Args:
        service_name: 서비스 이름 (예: "travel-agent")
        service_version: 서비스 버전 (예: "1.0.0")
        otlp_endpoint: OTLP 수집기 엔드포인트
        sampling_rate: 샘플링 비율 (0.0 ~ 1.0)
    """

    # 1. 리소스 정의 (서비스 메타데이터)
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
        "agent.type": "ai_agent",
    })

    # 2. 샘플러 설정
    if sampling_rate < 1.0:
        from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
        sampler = TraceIdRatioBased(sampling_rate)
    else:
        from opentelemetry.sdk.trace.sampling import ALWAYS_ON
        sampler = ALWAYS_ON

    # 3. TracerProvider 생성
    provider = TracerProvider(
        resource=resource,
        sampler=sampler
    )

    # 4. OTLP Exporter 설정
    otlp_exporter = OTLPSpanExporter(
        endpoint=otlp_endpoint,
        insecure=True  # Production에서는 TLS 사용
    )

    # 5. BatchSpanProcessor 추가 (성능 최적화)
    provider.add_span_processor(
        BatchSpanProcessor(
            otlp_exporter,
            max_queue_size=2048,
            max_export_batch_size=512,
            schedule_delay_millis=5000
        )
    )

    # 6. 글로벌 TracerProvider 설정
    trace.set_tracer_provider(provider)

    # 7. 컨텍스트 전파 설정 (B3 형식)
    set_global_textmap(B3MultiFormat())

    return provider
```

### 2.3 환경 변수 설정

```yaml
# docker-compose.yml 또는 Kubernetes 환경변수

environment:
  # OpenTelemetry 설정
  OTEL_SERVICE_NAME: "travel-agent"
  OTEL_SERVICE_VERSION: "1.0.0"
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
  OTEL_EXPORTER_OTLP_PROTOCOL: "grpc"
  OTEL_TRACES_SAMPLER: "traceidratio"
  OTEL_TRACES_SAMPLER_ARG: "1.0"

  # 추가 리소스 속성
  OTEL_RESOURCE_ATTRIBUTES: "deployment.environment=production,team=ai-platform"
```

---

## 3. 에이전트 Span 타입

### 3.1 커스텀 Span 타입 정의

```python
# agentops/tracing/spans.py

from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass
from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode
import time
import json

class AgentSpanType(str, Enum):
    """에이전트 전용 Span 타입"""

    # 최상위 요청
    AGENT_REQUEST = "agent.request"

    # 추론 관련
    REASONING = "agent.reasoning"
    PLANNING = "agent.planning"
    DECISION = "agent.decision"

    # LLM 관련
    LLM_CALL = "agent.llm.call"
    LLM_PROMPT = "agent.llm.prompt"
    LLM_COMPLETION = "agent.llm.completion"

    # 도구 관련
    TOOL_SELECTION = "agent.tool.selection"
    TOOL_CALL = "agent.tool.call"
    TOOL_EXECUTION = "agent.tool.execution"

    # 메모리 관련
    MEMORY_READ = "agent.memory.read"
    MEMORY_WRITE = "agent.memory.write"
    MEMORY_SEARCH = "agent.memory.search"

    # 에이전트 간 통신
    A2A_REQUEST = "agent.a2a.request"
    A2A_RESPONSE = "agent.a2a.response"
    DELEGATION = "agent.delegation"

    # 가드레일
    GUARDRAIL_INPUT = "agent.guardrail.input"
    GUARDRAIL_OUTPUT = "agent.guardrail.output"

    # 평가
    EVALUATION = "agent.evaluation"


# Semantic Conventions (에이전트 전용 속성)
class AgentAttributes:
    """에이전트 Span 속성 상수"""

    # 에이전트 식별
    AGENT_ID = "agent.id"
    AGENT_NAME = "agent.name"
    AGENT_VERSION = "agent.version"
    AGENT_TYPE = "agent.type"

    # 세션/요청
    SESSION_ID = "session.id"
    REQUEST_ID = "request.id"
    USER_ID = "user.id"

    # LLM 관련
    LLM_MODEL = "llm.model"
    LLM_PROVIDER = "llm.provider"
    LLM_TEMPERATURE = "llm.temperature"
    LLM_MAX_TOKENS = "llm.max_tokens"
    LLM_PROMPT_TOKENS = "llm.prompt_tokens"
    LLM_COMPLETION_TOKENS = "llm.completion_tokens"
    LLM_TOTAL_TOKENS = "llm.total_tokens"
    LLM_COST_USD = "llm.cost_usd"
    LLM_FINISH_REASON = "llm.finish_reason"

    # 도구 관련
    TOOL_NAME = "tool.name"
    TOOL_CATEGORY = "tool.category"
    TOOL_INPUT = "tool.input"
    TOOL_OUTPUT = "tool.output"
    TOOL_STATUS = "tool.status"
    TOOL_ERROR = "tool.error"

    # 추론 관련
    REASONING_STEP = "reasoning.step"
    REASONING_THOUGHT = "reasoning.thought"
    REASONING_ACTION = "reasoning.action"
    REASONING_CONFIDENCE = "reasoning.confidence"

    # 메모리 관련
    MEMORY_TYPE = "memory.type"
    MEMORY_QUERY = "memory.query"
    MEMORY_RESULTS_COUNT = "memory.results_count"

    # 가드레일
    GUARDRAIL_TYPE = "guardrail.type"
    GUARDRAIL_RESULT = "guardrail.result"
    GUARDRAIL_REASON = "guardrail.reason"

    # 비용
    COST_USD = "cost.usd"
    COST_CATEGORY = "cost.category"
```

### 3.2 Span 컨텍스트 관리

```python
# agentops/tracing/context.py

from contextlib import contextmanager
from typing import Optional, Dict, Any, Generator
from opentelemetry import trace
from opentelemetry.trace import Span, SpanKind

class AgentTracingContext:
    """
    에이전트 추적 컨텍스트 관리자
    """

    def __init__(self, tracer_name: str = "agentops"):
        self.tracer = trace.get_tracer(tracer_name)

    @contextmanager
    def start_request_span(
        self,
        agent_id: str,
        agent_name: str,
        session_id: str,
        request_id: str,
        action: str,
        user_id: Optional[str] = None,
        attributes: Dict[str, Any] = None
    ) -> Generator[Span, None, None]:
        """
        최상위 요청 Span 시작
        """
        with self.tracer.start_as_current_span(
            name=f"{agent_name}.{action}",
            kind=SpanKind.SERVER,
            attributes={
                AgentAttributes.AGENT_ID: agent_id,
                AgentAttributes.AGENT_NAME: agent_name,
                AgentAttributes.SESSION_ID: session_id,
                AgentAttributes.REQUEST_ID: request_id,
                AgentAttributes.USER_ID: user_id or "",
                "agent.span_type": AgentSpanType.AGENT_REQUEST,
                **(attributes or {})
            }
        ) as span:
            yield span

    @contextmanager
    def start_llm_span(
        self,
        model: str,
        provider: str,
        operation: str = "generate"
    ) -> Generator[Span, None, None]:
        """
        LLM 호출 Span
        """
        with self.tracer.start_as_current_span(
            name=f"llm.{provider}.{operation}",
            kind=SpanKind.CLIENT,
            attributes={
                "agent.span_type": AgentSpanType.LLM_CALL,
                AgentAttributes.LLM_MODEL: model,
                AgentAttributes.LLM_PROVIDER: provider,
            }
        ) as span:
            start_time = time.time()
            try:
                yield span
            finally:
                duration_ms = (time.time() - start_time) * 1000
                span.set_attribute("duration_ms", duration_ms)

    @contextmanager
    def start_tool_span(
        self,
        tool_name: str,
        tool_category: str = "general"
    ) -> Generator[Span, None, None]:
        """
        도구 호출 Span
        """
        with self.tracer.start_as_current_span(
            name=f"tool.{tool_name}",
            kind=SpanKind.INTERNAL,
            attributes={
                "agent.span_type": AgentSpanType.TOOL_CALL,
                AgentAttributes.TOOL_NAME: tool_name,
                AgentAttributes.TOOL_CATEGORY: tool_category,
            }
        ) as span:
            yield span

    @contextmanager
    def start_reasoning_span(
        self,
        step: str
    ) -> Generator[Span, None, None]:
        """
        추론 단계 Span
        """
        with self.tracer.start_as_current_span(
            name=f"reasoning.{step}",
            kind=SpanKind.INTERNAL,
            attributes={
                "agent.span_type": AgentSpanType.REASONING,
                AgentAttributes.REASONING_STEP: step,
            }
        ) as span:
            yield span

    @contextmanager
    def start_guardrail_span(
        self,
        guardrail_type: str,
        direction: str = "input"  # input or output
    ) -> Generator[Span, None, None]:
        """
        가드레일 검사 Span
        """
        span_type = (
            AgentSpanType.GUARDRAIL_INPUT
            if direction == "input"
            else AgentSpanType.GUARDRAIL_OUTPUT
        )

        with self.tracer.start_as_current_span(
            name=f"guardrail.{direction}.{guardrail_type}",
            kind=SpanKind.INTERNAL,
            attributes={
                "agent.span_type": span_type,
                AgentAttributes.GUARDRAIL_TYPE: guardrail_type,
            }
        ) as span:
            yield span

    @contextmanager
    def start_delegation_span(
        self,
        target_agent: str,
        task: str
    ) -> Generator[Span, None, None]:
        """
        에이전트 위임 Span
        """
        with self.tracer.start_as_current_span(
            name=f"delegate.{target_agent}",
            kind=SpanKind.CLIENT,
            attributes={
                "agent.span_type": AgentSpanType.DELEGATION,
                "target.agent": target_agent,
                "delegation.task": task,
            }
        ) as span:
            yield span
```

---

## 4. 자동 계측

### 4.1 LLM 클라이언트 자동 계측

```python
# agentops/tracing/instrumentation/llm.py

from functools import wraps
from typing import Callable, Any
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
import time

def trace_llm_call(
    model_attr: str = "model",
    provider: str = "unknown"
):
    """
    LLM 호출 자동 추적 데코레이터

    Usage:
        @trace_llm_call(model_attr="model", provider="openai")
        async def generate(self, prompt: str, model: str = "gpt-4"):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            tracer = trace.get_tracer("agentops.llm")

            # 모델 이름 추출
            model = kwargs.get(model_attr, "unknown")
            if isinstance(args[0], object) and hasattr(args[0], model_attr):
                model = getattr(args[0], model_attr, model)

            with tracer.start_as_current_span(
                f"llm.{provider}.{func.__name__}",
                kind=trace.SpanKind.CLIENT,
                attributes={
                    "agent.span_type": AgentSpanType.LLM_CALL,
                    AgentAttributes.LLM_MODEL: model,
                    AgentAttributes.LLM_PROVIDER: provider,
                }
            ) as span:
                start_time = time.time()

                try:
                    result = await func(*args, **kwargs)

                    # 응답에서 토큰 정보 추출
                    if hasattr(result, 'usage'):
                        usage = result.usage
                        span.set_attribute(
                            AgentAttributes.LLM_PROMPT_TOKENS,
                            getattr(usage, 'prompt_tokens', 0)
                        )
                        span.set_attribute(
                            AgentAttributes.LLM_COMPLETION_TOKENS,
                            getattr(usage, 'completion_tokens', 0)
                        )
                        span.set_attribute(
                            AgentAttributes.LLM_TOTAL_TOKENS,
                            getattr(usage, 'total_tokens', 0)
                        )

                        # 비용 계산
                        cost = calculate_cost(
                            model,
                            usage.prompt_tokens,
                            usage.completion_tokens
                        )
                        span.set_attribute(AgentAttributes.LLM_COST_USD, cost)

                    if hasattr(result, 'choices') and result.choices:
                        finish_reason = result.choices[0].finish_reason
                        span.set_attribute(
                            AgentAttributes.LLM_FINISH_REASON,
                            finish_reason
                        )

                    span.set_status(Status(StatusCode.OK))
                    return result

                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

                finally:
                    duration_ms = (time.time() - start_time) * 1000
                    span.set_attribute("duration_ms", duration_ms)

        return wrapper
    return decorator


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """토큰 비용 계산"""
    pricing = {
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-4o": {"input": 0.005, "output": 0.015},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3.5-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    }

    rates = pricing.get(model, {"input": 0.01, "output": 0.03})

    return (
        (prompt_tokens / 1000) * rates["input"] +
        (completion_tokens / 1000) * rates["output"]
    )
```

### 4.2 도구 호출 자동 계측

```python
# agentops/tracing/instrumentation/tools.py

from functools import wraps
from typing import Callable, Any, Dict
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
import json
import time

def trace_tool_call(
    tool_name: str = None,
    category: str = "general",
    capture_input: bool = True,
    capture_output: bool = True,
    max_data_length: int = 1000
):
    """
    도구 호출 자동 추적 데코레이터

    Usage:
        @trace_tool_call(tool_name="web_search", category="search")
        async def search_web(query: str) -> list:
            ...
    """
    def decorator(func: Callable) -> Callable:
        nonlocal tool_name
        if tool_name is None:
            tool_name = func.__name__

        @wraps(func)
        async def wrapper(*args, **kwargs):
            tracer = trace.get_tracer("agentops.tools")

            with tracer.start_as_current_span(
                f"tool.{tool_name}",
                kind=trace.SpanKind.INTERNAL,
                attributes={
                    "agent.span_type": AgentSpanType.TOOL_CALL,
                    AgentAttributes.TOOL_NAME: tool_name,
                    AgentAttributes.TOOL_CATEGORY: category,
                }
            ) as span:
                start_time = time.time()

                # 입력 기록
                if capture_input:
                    input_str = _serialize_args(args, kwargs, max_data_length)
                    span.set_attribute(AgentAttributes.TOOL_INPUT, input_str)

                try:
                    result = await func(*args, **kwargs)

                    # 출력 기록
                    if capture_output:
                        output_str = _serialize_output(result, max_data_length)
                        span.set_attribute(AgentAttributes.TOOL_OUTPUT, output_str)

                    span.set_attribute(AgentAttributes.TOOL_STATUS, "success")
                    span.set_status(Status(StatusCode.OK))

                    return result

                except Exception as e:
                    span.set_attribute(AgentAttributes.TOOL_STATUS, "error")
                    span.set_attribute(AgentAttributes.TOOL_ERROR, str(e))
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

                finally:
                    duration_ms = (time.time() - start_time) * 1000
                    span.set_attribute("duration_ms", duration_ms)

        return wrapper
    return decorator


def _serialize_args(args, kwargs, max_length: int) -> str:
    """인자 직렬화"""
    try:
        # self 제외
        args_to_serialize = args[1:] if args and hasattr(args[0], '__dict__') else args
        data = {
            "args": [str(a)[:max_length] for a in args_to_serialize],
            "kwargs": {k: str(v)[:max_length] for k, v in kwargs.items()}
        }
        return json.dumps(data)[:max_length]
    except:
        return "<serialization_error>"


def _serialize_output(output: Any, max_length: int) -> str:
    """출력 직렬화"""
    try:
        return json.dumps(output, default=str)[:max_length]
    except:
        return str(output)[:max_length]
```

---

## 5. 사용 예시

### 5.1 완전한 에이전트 추적 예시

```python
# example_agent.py

from agentops.tracing import setup_tracing, AgentTracingContext
from agentops.tracing.instrumentation import trace_llm_call, trace_tool_call

# 추적 초기화
setup_tracing(
    service_name="travel-booking-agent",
    service_version="1.0.0",
    otlp_endpoint="http://otel-collector:4317"
)

ctx = AgentTracingContext()


class TravelBookingAgent:
    def __init__(self, agent_id: str, name: str):
        self.agent_id = agent_id
        self.name = name
        self.llm_client = OpenAIClient()
        self.tools = ToolRegistry()

    async def process_request(
        self,
        request: dict,
        session_id: str,
        user_id: str
    ) -> dict:
        """여행 예약 요청 처리"""

        request_id = str(uuid.uuid4())

        # 최상위 요청 Span
        with ctx.start_request_span(
            agent_id=self.agent_id,
            agent_name=self.name,
            session_id=session_id,
            request_id=request_id,
            action="book_travel",
            user_id=user_id
        ) as span:

            try:
                # 1. 입력 가드레일
                with ctx.start_guardrail_span("input_validation", "input") as gs:
                    validation = await self._validate_input(request)
                    gs.set_attribute(AgentAttributes.GUARDRAIL_RESULT, validation.valid)
                    if not validation.valid:
                        gs.set_attribute(AgentAttributes.GUARDRAIL_REASON, validation.reason)
                        return {"error": validation.reason}

                # 2. 의도 분석
                with ctx.start_reasoning_span("analyze_intent") as rs:
                    intent = await self._analyze_intent(request)
                    rs.set_attribute(AgentAttributes.REASONING_THOUGHT, intent.summary)
                    rs.set_attribute(AgentAttributes.REASONING_CONFIDENCE, intent.confidence)

                # 3. 계획 수립
                with ctx.start_reasoning_span("create_plan") as rs:
                    plan = await self._create_plan(intent)
                    rs.set_attribute("plan.steps", json.dumps(plan.steps))

                # 4. 계획 실행
                results = []
                for step in plan.steps:
                    if step.requires_delegation:
                        # 다른 에이전트에게 위임
                        with ctx.start_delegation_span(
                            target_agent=step.target_agent,
                            task=step.task
                        ) as ds:
                            result = await self._delegate(step)
                            ds.set_attribute("delegation.success", result.success)
                    else:
                        # 도구 실행
                        with ctx.start_tool_span(
                            tool_name=step.tool,
                            tool_category=step.category
                        ) as ts:
                            result = await self._execute_tool(step)
                            ts.set_attribute(AgentAttributes.TOOL_STATUS, "success" if result.success else "error")

                    results.append(result)

                # 5. 응답 생성
                response = await self._generate_response(results)

                # 6. 출력 가드레일
                with ctx.start_guardrail_span("content_filter", "output") as gs:
                    filtered = await self._filter_output(response)
                    gs.set_attribute(AgentAttributes.GUARDRAIL_RESULT, filtered.passed)

                span.set_status(Status(StatusCode.OK))
                return {"success": True, "data": filtered.content}

            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                return {"error": str(e)}

    @trace_llm_call(model_attr="model", provider="openai")
    async def _analyze_intent(self, request: dict) -> Intent:
        """의도 분석 (LLM 호출)"""
        prompt = f"Analyze the user's travel request: {request}"
        response = await self.llm_client.generate(
            prompt=prompt,
            model="gpt-4o"
        )
        return Intent.from_response(response)

    @trace_tool_call(tool_name="flight_search", category="booking")
    async def _search_flights(self, criteria: dict) -> list:
        """항공편 검색"""
        return await self.tools.get("flight_search").execute(criteria)
```

### 5.2 Trace 출력 예시

```
Trace ID: 4bf92f3577b34da6a3ce929d0e0e4736

📍 travel-booking-agent.book_travel [2340ms]
│   agent.id: agent-001
│   agent.name: travel-booking-agent
│   session.id: sess_abc123
│   request.id: req_xyz789
│   user.id: user_456
│
├── 🛡️ guardrail.input.input_validation [12ms]
│   guardrail.type: input_validation
│   guardrail.result: true
│
├── 🧠 reasoning.analyze_intent [245ms]
│   reasoning.step: analyze_intent
│   reasoning.confidence: 0.95
│   │
│   └── 🤖 llm.openai.generate [238ms]
│       llm.model: gpt-4o
│       llm.provider: openai
│       llm.prompt_tokens: 156
│       llm.completion_tokens: 89
│       llm.total_tokens: 245
│       llm.cost_usd: 0.00212
│
├── 🧠 reasoning.create_plan [180ms]
│   reasoning.step: create_plan
│   plan.steps: ["search_flights", "search_hotels", "create_itinerary"]
│
├── 🔧 tool.flight_search [1200ms]
│   tool.name: flight_search
│   tool.category: booking
│   tool.status: success
│   tool.input: {"from": "ICN", "to": "NRT", "date": "2024-12-20"}
│   │
│   └── 🌐 HTTP GET api.amadeus.com [1150ms]
│       http.status_code: 200
│
├── 👥 delegate.hotel-booking-agent [520ms]
│   target.agent: hotel-booking-agent
│   delegation.task: search_hotels
│   delegation.success: true
│
├── 🤖 llm.openai.generate [165ms]
│   llm.model: gpt-4o
│   llm.prompt_tokens: 450
│   llm.completion_tokens: 280
│   llm.total_tokens: 730
│   llm.cost_usd: 0.00645
│
└── 🛡️ guardrail.output.content_filter [8ms]
    guardrail.type: content_filter
    guardrail.result: true

─────────────────────────────────────
Summary:
  Total Duration: 2340ms
  LLM Calls: 2
  Total Tokens: 975
  Total Cost: $0.00857
  Tools Used: flight_search
  Delegations: hotel-booking-agent
```

---

## 6. OTEL Collector 설정

### 6.1 Collector 구성

```yaml
# otel-collector-config.yaml

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 512
    send_batch_max_size: 1024

  memory_limiter:
    check_interval: 1s
    limit_mib: 1000
    spike_limit_mib: 200

  # 에이전트 메타데이터 추가
  attributes:
    actions:
      - key: service.platform
        value: agentops
        action: insert

  # 민감 정보 필터링
  filter:
    spans:
      exclude:
        match_type: regexp
        attributes:
          - key: tool.input
            value: ".*password.*"

exporters:
  # Jaeger로 전송
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  # Tempo로 전송
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

  # ClickHouse로 분석용 전송
  clickhouse:
    endpoint: tcp://clickhouse:9000
    database: traces
    ttl_days: 30

  # 디버그 출력
  debug:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [jaeger, otlp/tempo, clickhouse]
```

---

## 7. 다음 단계

- [메트릭 수집](./metrics) - Prometheus 메트릭 구현
- [구조화 로깅](./logging) - 로그 수집 시스템
- [평가 시스템](./evaluation) - 품질 평가 파이프라인
