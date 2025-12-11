---
sidebar_position: 3
title: "Observability Layer"
description: "AgentOps 관찰 가능성 계층 - 추적, 메트릭, 로깅, 평가"
---

# Observability Layer 설계

Observability Layer는 AI 에이전트의 **모든 행동을 기록하고 분석**하는 핵심 계층입니다. 기존 APM과 달리, 에이전트의 **추론 과정**과 **의사 결정**을 추적해야 합니다.

---

## 1. 관찰 가능성의 세 기둥 + 평가

### 1.1 AI 에이전트를 위한 확장된 관찰 가능성

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Extended Observability Pillars                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Traditional Observability          Agent-Specific Extensions            │
│  ┌─────────────────────┐           ┌─────────────────────┐              │
│  │                     │           │                     │              │
│  │  📍 Traces          │           │  🧠 Reasoning Traces│              │
│  │  Request paths      │    +      │  Thought processes  │              │
│  │  Latency breakdown  │           │  Decision trees     │              │
│  │                     │           │                     │              │
│  ├─────────────────────┤           ├─────────────────────┤              │
│  │                     │           │                     │              │
│  │  📊 Metrics         │           │  💰 Cost Metrics    │              │
│  │  Throughput, errors │    +      │  Token usage        │              │
│  │  Latency percentile │           │  $/request          │              │
│  │                     │           │                     │              │
│  ├─────────────────────┤           ├─────────────────────┤              │
│  │                     │           │                     │              │
│  │  📝 Logs            │           │  💭 Reasoning Logs  │              │
│  │  Events, errors     │    +      │  LLM I/O            │              │
│  │  Debug info         │           │  Tool interactions  │              │
│  │                     │           │                     │              │
│  └─────────────────────┘           └─────────────────────┘              │
│                                                                          │
│                    ┌─────────────────────┐                              │
│                    │                     │                              │
│                    │  ✅ Evaluations     │  ← NEW PILLAR                │
│                    │  Quality scores     │                              │
│                    │  Task completion    │                              │
│                    │  Behavior analysis  │                              │
│                    │                     │                              │
│                    └─────────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 각 기둥의 역할

| 기둥 | 질문 | 데이터 특성 |
|------|------|------------|
| **Traces** | "무엇이 일어났나?" | 고카디널리티, 인과 관계 |
| **Metrics** | "얼마나 자주/많이?" | 집계 가능, 시계열 |
| **Logs** | "왜 일어났나?" | 비구조화/구조화, 상세 컨텍스트 |
| **Evals** | "얼마나 잘했나?" | 품질 점수, 벤치마크 비교 |

---

## 2. 전체 아키텍처

### 2.1 데이터 수집 파이프라인

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Observability Data Pipeline                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Data Sources              Collection         Storage        Consumers  │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐    ┌─────────┐                │
│  │Agent Runtime│───OTLP──│             │    │         │                │
│  │  (Traces)   │         │             │───▶│ Jaeger  │                │
│  └─────────────┘         │             │    │ /Tempo  │                │
│                          │             │    └─────────┘                │
│  ┌─────────────┐         │    OTEL     │                               │
│  │ Agent SDK   │───OTLP──│  Collector  │    ┌─────────┐    ┌────────┐ │
│  │  (Spans)    │         │             │───▶│Prometheus│───▶│Grafana │ │
│  └─────────────┘         │   (Gateway) │    └─────────┘    └────────┘ │
│                          │             │                               │
│  ┌─────────────┐         │             │    ┌─────────┐                │
│  │  LLM Calls  │───OTLP──│             │───▶│  Loki   │                │
│  │  (Tokens)   │         │             │    │/Elastic │                │
│  └─────────────┘         └─────────────┘    └─────────┘                │
│                                │                                        │
│  ┌─────────────┐               │            ┌─────────┐    ┌────────┐ │
│  │   Evals     │───────────────┘───────────▶│ClickHouse│──▶│Dashboard│ │
│  │  (Scores)   │                            └─────────┘    └────────┘ │
│  └─────────────┘                                                       │
│                                                                          │
│                          ┌─────────────┐    ┌─────────┐                │
│                          │   Alerting  │◀───│  Rules  │                │
│                          │   Engine    │    │ Engine  │                │
│                          └──────┬──────┘    └─────────┘                │
│                                 │                                       │
│                          ┌──────▼──────┐                               │
│                          │PagerDuty/   │                               │
│                          │Slack/Email  │                               │
│                          └─────────────┘                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 핵심 컴포넌트

```python
from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum
from datetime import datetime

class TelemetryType(Enum):
    TRACE = "trace"
    METRIC = "metric"
    LOG = "log"
    EVALUATION = "evaluation"

@dataclass
class ObservabilityConfig:
    """관찰 가능성 설정"""
    # 추적 설정
    tracing_enabled: bool = True
    trace_sampling_rate: float = 1.0  # 0.0 - 1.0
    trace_exporter: str = "otlp"  # otlp, jaeger, zipkin
    trace_endpoint: str = "http://otel-collector:4317"

    # 메트릭 설정
    metrics_enabled: bool = True
    metrics_exporter: str = "prometheus"  # prometheus, otlp
    metrics_port: int = 9090
    metrics_path: str = "/metrics"

    # 로깅 설정
    logging_enabled: bool = True
    log_level: str = "INFO"
    log_format: str = "json"  # json, text
    log_exporter: str = "loki"  # loki, elasticsearch, stdout

    # 평가 설정
    evaluation_enabled: bool = True
    auto_eval_sample_rate: float = 0.1  # 10% 자동 평가
    eval_storage: str = "clickhouse"

    # 비용 추적
    cost_tracking_enabled: bool = True
```

---

## 3. Tracing Service

### 3.1 에이전트 전용 Span 타입

```python
from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode
from typing import Any, Dict, Optional
import time

class AgentSpanKind(Enum):
    """에이전트 전용 Span 종류"""
    AGENT_REQUEST = "agent.request"           # 최상위 에이전트 요청
    REASONING = "agent.reasoning"              # 추론 단계
    LLM_CALL = "agent.llm_call"               # LLM API 호출
    TOOL_CALL = "agent.tool_call"             # 도구 호출
    TOOL_EXECUTION = "agent.tool_execution"   # 도구 실행
    MEMORY_ACCESS = "agent.memory_access"     # 메모리 접근
    PLANNING = "agent.planning"               # 계획 수립
    DELEGATION = "agent.delegation"           # 다른 에이전트 위임
    GUARDRAIL_CHECK = "agent.guardrail"       # 가드레일 검사
    EVALUATION = "agent.evaluation"           # 품질 평가

@dataclass
class AgentSpanAttributes:
    """에이전트 Span 표준 속성"""
    # 공통 속성
    agent_id: str
    agent_name: str
    agent_version: str
    session_id: str
    trace_id: str

    # LLM 관련 속성
    llm_model: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_temperature: Optional[float] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

    # 도구 관련 속성
    tool_name: Optional[str] = None
    tool_input: Optional[str] = None
    tool_output: Optional[str] = None
    tool_status: Optional[str] = None

    # 비용 속성
    cost_usd: Optional[float] = None

class AgentTracer:
    """
    에이전트 전용 트레이서
    OpenTelemetry 기반 확장
    """

    def __init__(
        self,
        service_name: str,
        config: ObservabilityConfig
    ):
        self.config = config
        self.tracer = trace.get_tracer(
            service_name,
            schema_url="https://opentelemetry.io/schemas/1.21.0"
        )
        self._setup_exporters()

    def _setup_exporters(self):
        """트레이스 익스포터 설정"""
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

        provider = TracerProvider()

        if self.config.trace_exporter == "otlp":
            exporter = OTLPSpanExporter(
                endpoint=self.config.trace_endpoint
            )
            provider.add_span_processor(
                BatchSpanProcessor(exporter)
            )

        trace.set_tracer_provider(provider)

    def start_agent_span(
        self,
        name: str,
        kind: AgentSpanKind,
        attributes: AgentSpanAttributes,
        parent_context: Optional[Any] = None
    ):
        """에이전트 Span 시작"""
        span = self.tracer.start_span(
            name,
            kind=SpanKind.INTERNAL,
            context=parent_context,
            attributes={
                "agent.span_kind": kind.value,
                "agent.id": attributes.agent_id,
                "agent.name": attributes.agent_name,
                "agent.version": attributes.agent_version,
                "session.id": attributes.session_id,
            }
        )

        return AgentSpan(span, attributes)

    def trace_llm_call(self):
        """LLM 호출 트레이싱 데코레이터"""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                span_name = f"llm.{kwargs.get('model', 'unknown')}"

                with self.tracer.start_as_current_span(
                    span_name,
                    kind=SpanKind.CLIENT
                ) as span:
                    span.set_attribute("agent.span_kind", AgentSpanKind.LLM_CALL.value)

                    start_time = time.time()

                    try:
                        result = await func(*args, **kwargs)

                        # LLM 응답에서 토큰 정보 추출
                        if hasattr(result, 'usage'):
                            span.set_attribute("llm.prompt_tokens", result.usage.prompt_tokens)
                            span.set_attribute("llm.completion_tokens", result.usage.completion_tokens)
                            span.set_attribute("llm.total_tokens", result.usage.total_tokens)

                            # 비용 계산
                            cost = self._calculate_cost(
                                kwargs.get('model'),
                                result.usage.prompt_tokens,
                                result.usage.completion_tokens
                            )
                            span.set_attribute("llm.cost_usd", cost)

                        span.set_status(Status(StatusCode.OK))
                        return result

                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        span.record_exception(e)
                        raise

                    finally:
                        duration = time.time() - start_time
                        span.set_attribute("llm.duration_ms", duration * 1000)

            return wrapper
        return decorator

    def trace_tool_call(self):
        """도구 호출 트레이싱 데코레이터"""
        def decorator(func):
            async def wrapper(tool_name: str, tool_input: Dict, *args, **kwargs):
                span_name = f"tool.{tool_name}"

                with self.tracer.start_as_current_span(
                    span_name,
                    kind=SpanKind.INTERNAL
                ) as span:
                    span.set_attribute("agent.span_kind", AgentSpanKind.TOOL_CALL.value)
                    span.set_attribute("tool.name", tool_name)
                    span.set_attribute("tool.input", json.dumps(tool_input)[:1000])  # 크기 제한

                    try:
                        result = await func(tool_name, tool_input, *args, **kwargs)

                        span.set_attribute("tool.output", json.dumps(result)[:1000])
                        span.set_attribute("tool.status", "success")
                        span.set_status(Status(StatusCode.OK))

                        return result

                    except Exception as e:
                        span.set_attribute("tool.status", "error")
                        span.set_attribute("tool.error", str(e))
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        span.record_exception(e)
                        raise

            return wrapper
        return decorator

    def _calculate_cost(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> float:
        """LLM 비용 계산"""
        pricing = {
            "gpt-4": {"input": 0.03/1000, "output": 0.06/1000},
            "gpt-4-turbo": {"input": 0.01/1000, "output": 0.03/1000},
            "gpt-4o": {"input": 0.005/1000, "output": 0.015/1000},
            "gpt-3.5-turbo": {"input": 0.0005/1000, "output": 0.0015/1000},
            "claude-3-opus": {"input": 0.015/1000, "output": 0.075/1000},
            "claude-3-sonnet": {"input": 0.003/1000, "output": 0.015/1000},
            "claude-3-haiku": {"input": 0.00025/1000, "output": 0.00125/1000},
            "claude-3.5-sonnet": {"input": 0.003/1000, "output": 0.015/1000},
        }

        rates = pricing.get(model, {"input": 0.01/1000, "output": 0.03/1000})
        return (prompt_tokens * rates["input"]) + (completion_tokens * rates["output"])
```

### 3.2 추적 시각화 예시

```
Trace: req_2024120500001 [Total: 2.3s]
│
├── [Agent: Orchestrator] handle_request (2.3s) ────────────────────────
│   │ agent.id: orchestrator-001
│   │ session.id: sess_abc123
│   │
│   ├── [Guardrail] input_validation (15ms) ✓
│   │   └── guardrail.checks: ["pii", "injection", "length"]
│   │
│   ├── [Reasoning] analyze_intent (180ms)
│   │   │
│   │   └── [LLM] gpt-4o (175ms) ─────────────────────────────────────
│   │       │ llm.prompt_tokens: 250
│   │       │ llm.completion_tokens: 85
│   │       │ llm.cost_usd: $0.0025
│   │       └── [Response] intent: "book_flight"
│   │
│   ├── [Planning] create_execution_plan (45ms)
│   │   └── plan.steps: ["search_flights", "filter_results", "present"]
│   │
│   ├── [Delegation] flight_search_agent (1.8s) ──────────────────────
│   │   │ target_agent: flight-search-v2
│   │   │
│   │   ├── [Tool] amadeus_search (1.2s)
│   │   │   │ tool.name: amadeus_flight_search
│   │   │   │ tool.input: {"from": "ICN", "to": "NRT", "date": "2024-12-20"}
│   │   │   │ tool.status: success
│   │   │   └── [HTTP] GET api.amadeus.com/flights (1.15s)
│   │   │
│   │   ├── [Tool] skyscanner_search (1.1s)
│   │   │   │ tool.name: skyscanner_api
│   │   │   │ tool.status: success
│   │   │   └── [HTTP] GET partners.api.skyscanner.net (1.05s)
│   │   │
│   │   └── [Reasoning] merge_results (150ms)
│   │       └── [LLM] claude-3-haiku (145ms)
│   │           └── llm.cost_usd: $0.0003
│   │
│   ├── [Reasoning] format_response (120ms)
│   │   └── [LLM] gpt-4o (115ms)
│   │       └── llm.cost_usd: $0.0018
│   │
│   └── [Guardrail] output_validation (10ms) ✓
│
└── [Summary]
    ├── total_llm_calls: 4
    ├── total_tokens: 1,250
    ├── total_cost: $0.0046
    └── tools_used: ["amadeus_flight_search", "skyscanner_api"]
```

---

## 4. Metrics Service

### 4.1 에이전트 메트릭 정의

```python
from prometheus_client import Counter, Histogram, Gauge, Summary
from typing import Dict, List

class AgentMetrics:
    """
    에이전트 전용 메트릭 정의
    """

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self._setup_metrics()

    def _setup_metrics(self):
        # ==================== Request Metrics ====================

        self.request_total = Counter(
            'agent_requests_total',
            'Total number of agent requests',
            ['agent', 'action', 'status']
        )

        self.request_duration = Histogram(
            'agent_request_duration_seconds',
            'Agent request duration in seconds',
            ['agent', 'action'],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
        )

        self.request_in_progress = Gauge(
            'agent_requests_in_progress',
            'Number of requests currently in progress',
            ['agent']
        )

        # ==================== LLM Metrics ====================

        self.llm_calls_total = Counter(
            'agent_llm_calls_total',
            'Total LLM API calls',
            ['agent', 'model', 'status']
        )

        self.llm_duration = Histogram(
            'agent_llm_duration_seconds',
            'LLM call duration',
            ['agent', 'model'],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
        )

        self.tokens_total = Counter(
            'agent_tokens_total',
            'Total tokens used',
            ['agent', 'model', 'type']  # type: input/output
        )

        # ==================== Tool Metrics ====================

        self.tool_calls_total = Counter(
            'agent_tool_calls_total',
            'Total tool invocations',
            ['agent', 'tool', 'status']
        )

        self.tool_duration = Histogram(
            'agent_tool_duration_seconds',
            'Tool execution duration',
            ['agent', 'tool'],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
        )

        # ==================== Cost Metrics ====================

        self.cost_total = Counter(
            'agent_cost_usd_total',
            'Total cost in USD',
            ['agent', 'model', 'cost_type']  # cost_type: llm, tool, etc.
        )

        self.cost_per_request = Summary(
            'agent_cost_per_request_usd',
            'Cost per request in USD',
            ['agent']
        )

        # ==================== Quality Metrics ====================

        self.evaluation_score = Gauge(
            'agent_evaluation_score',
            'Latest evaluation score',
            ['agent', 'metric']  # metric: task_completion, quality, etc.
        )

        self.evaluation_total = Counter(
            'agent_evaluations_total',
            'Total evaluations performed',
            ['agent', 'result']  # result: pass, fail
        )

        # ==================== Session Metrics ====================

        self.active_sessions = Gauge(
            'agent_active_sessions',
            'Number of active sessions',
            ['agent']
        )

        self.session_duration = Histogram(
            'agent_session_duration_seconds',
            'Session duration',
            ['agent'],
            buckets=[60, 300, 600, 1800, 3600, 7200]
        )

        # ==================== Error Metrics ====================

        self.errors_total = Counter(
            'agent_errors_total',
            'Total errors',
            ['agent', 'error_type', 'severity']
        )

        self.guardrail_triggers = Counter(
            'agent_guardrail_triggers_total',
            'Guardrail trigger count',
            ['agent', 'guardrail_type', 'action']  # action: block, warn
        )

    # ==================== Recording Methods ====================

    def record_request(
        self,
        action: str,
        status: str,
        duration: float
    ):
        """요청 메트릭 기록"""
        self.request_total.labels(
            agent=self.agent_name,
            action=action,
            status=status
        ).inc()

        self.request_duration.labels(
            agent=self.agent_name,
            action=action
        ).observe(duration)

    def record_llm_call(
        self,
        model: str,
        status: str,
        duration: float,
        prompt_tokens: int,
        completion_tokens: int
    ):
        """LLM 호출 메트릭 기록"""
        self.llm_calls_total.labels(
            agent=self.agent_name,
            model=model,
            status=status
        ).inc()

        self.llm_duration.labels(
            agent=self.agent_name,
            model=model
        ).observe(duration)

        self.tokens_total.labels(
            agent=self.agent_name,
            model=model,
            type="input"
        ).inc(prompt_tokens)

        self.tokens_total.labels(
            agent=self.agent_name,
            model=model,
            type="output"
        ).inc(completion_tokens)

        # 비용 기록
        cost = self._calculate_cost(model, prompt_tokens, completion_tokens)
        self.cost_total.labels(
            agent=self.agent_name,
            model=model,
            cost_type="llm"
        ).inc(cost)

    def record_tool_call(
        self,
        tool: str,
        status: str,
        duration: float
    ):
        """도구 호출 메트릭 기록"""
        self.tool_calls_total.labels(
            agent=self.agent_name,
            tool=tool,
            status=status
        ).inc()

        self.tool_duration.labels(
            agent=self.agent_name,
            tool=tool
        ).observe(duration)

    def record_evaluation(
        self,
        metric_name: str,
        score: float,
        passed: bool
    ):
        """평가 메트릭 기록"""
        self.evaluation_score.labels(
            agent=self.agent_name,
            metric=metric_name
        ).set(score)

        self.evaluation_total.labels(
            agent=self.agent_name,
            result="pass" if passed else "fail"
        ).inc()
```

### 4.2 대시보드 쿼리 예시

```yaml
# Grafana Dashboard - AgentOps Overview
# grafana-dashboard.yaml

panels:
  # 요청률 및 에러율
  - title: "Request Rate (req/s)"
    type: graph
    gridPos: {h: 8, w: 12, x: 0, y: 0}
    targets:
      - expr: sum(rate(agent_requests_total[5m])) by (agent)
        legendFormat: "{{agent}}"

  - title: "Error Rate (%)"
    type: graph
    gridPos: {h: 8, w: 12, x: 12, y: 0}
    targets:
      - expr: |
          sum(rate(agent_requests_total{status="error"}[5m])) by (agent)
          /
          sum(rate(agent_requests_total[5m])) by (agent)
          * 100
        legendFormat: "{{agent}}"

  # 지연 시간
  - title: "Request Latency (p95)"
    type: graph
    gridPos: {h: 8, w: 12, x: 0, y: 8}
    targets:
      - expr: |
          histogram_quantile(0.95,
            sum(rate(agent_request_duration_seconds_bucket[5m])) by (agent, le)
          )
        legendFormat: "{{agent}}"

  # 토큰 사용량
  - title: "Token Usage (tokens/min)"
    type: graph
    gridPos: {h: 8, w: 12, x: 12, y: 8}
    targets:
      - expr: sum(rate(agent_tokens_total[1m])) by (agent, model, type) * 60
        legendFormat: "{{agent}} - {{model}} - {{type}}"

  # 비용 추적
  - title: "Hourly Cost ($)"
    type: stat
    gridPos: {h: 4, w: 6, x: 0, y: 16}
    targets:
      - expr: sum(increase(agent_cost_usd_total[1h]))
    options:
      colorMode: value
      graphMode: area

  - title: "Cost by Model"
    type: piechart
    gridPos: {h: 8, w: 6, x: 6, y: 16}
    targets:
      - expr: sum(agent_cost_usd_total) by (model)
        legendFormat: "{{model}}"

  # 품질 메트릭
  - title: "Evaluation Scores"
    type: gauge
    gridPos: {h: 8, w: 12, x: 12, y: 16}
    targets:
      - expr: agent_evaluation_score
        legendFormat: "{{agent}} - {{metric}}"
    options:
      thresholds:
        - value: 0.6
          color: red
        - value: 0.8
          color: yellow
        - value: 0.9
          color: green

  # 가드레일 트리거
  - title: "Guardrail Triggers"
    type: timeseries
    gridPos: {h: 8, w: 12, x: 0, y: 24}
    targets:
      - expr: sum(rate(agent_guardrail_triggers_total[5m])) by (guardrail_type, action)
        legendFormat: "{{guardrail_type}} - {{action}}"
```

---

## 5. Logging Service

### 5.1 구조화 로그 스키마

```python
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum
import json
import structlog

class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class LogCategory(Enum):
    AGENT_LIFECYCLE = "agent.lifecycle"      # 시작, 종료, 상태 변경
    REQUEST = "agent.request"                 # 요청 처리
    LLM = "agent.llm"                        # LLM 호출
    TOOL = "agent.tool"                      # 도구 호출
    REASONING = "agent.reasoning"            # 추론 과정
    MEMORY = "agent.memory"                  # 메모리 접근
    GUARDRAIL = "agent.guardrail"            # 가드레일
    EVALUATION = "agent.evaluation"          # 평가
    ERROR = "agent.error"                    # 에러

@dataclass
class AgentLogEntry:
    """에이전트 로그 엔트리"""
    # 필수 필드
    timestamp: str
    level: LogLevel
    category: LogCategory
    message: str

    # 컨텍스트 필드
    agent_id: str = ""
    agent_name: str = ""
    session_id: str = ""
    trace_id: str = ""
    span_id: str = ""

    # 선택 필드
    request_id: Optional[str] = None
    user_id: Optional[str] = None

    # 상세 데이터
    data: Dict[str, Any] = field(default_factory=dict)

    # 에러 정보
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str)

class AgentLogger:
    """
    구조화된 에이전트 로거
    """

    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        config: ObservabilityConfig
    ):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.config = config
        self._setup_logger()

    def _setup_logger(self):
        """structlog 설정"""
        processors = [
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
        ]

        if self.config.log_format == "json":
            processors.append(structlog.processors.JSONRenderer())
        else:
            processors.append(structlog.dev.ConsoleRenderer())

        structlog.configure(
            processors=processors,
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
        )

        self.logger = structlog.get_logger()

    def _create_entry(
        self,
        level: LogLevel,
        category: LogCategory,
        message: str,
        **kwargs
    ) -> AgentLogEntry:
        """로그 엔트리 생성"""
        from opentelemetry import trace

        # 현재 트레이스 컨텍스트 가져오기
        current_span = trace.get_current_span()
        span_context = current_span.get_span_context() if current_span else None

        return AgentLogEntry(
            timestamp=datetime.utcnow().isoformat(),
            level=level,
            category=category,
            message=message,
            agent_id=self.agent_id,
            agent_name=self.agent_name,
            trace_id=format(span_context.trace_id, '032x') if span_context else "",
            span_id=format(span_context.span_id, '016x') if span_context else "",
            **kwargs
        )

    # ==================== Logging Methods ====================

    def log_request_start(
        self,
        request_id: str,
        session_id: str,
        user_id: str,
        action: str,
        input_data: Dict
    ):
        """요청 시작 로그"""
        entry = self._create_entry(
            level=LogLevel.INFO,
            category=LogCategory.REQUEST,
            message=f"Request started: {action}",
            request_id=request_id,
            session_id=session_id,
            user_id=user_id,
            data={
                "action": action,
                "input_summary": self._summarize_input(input_data)
            }
        )
        self.logger.info(entry.message, **entry.__dict__)

    def log_llm_call(
        self,
        model: str,
        prompt_summary: str,
        completion_summary: str,
        tokens: Dict[str, int],
        duration_ms: float,
        cost_usd: float
    ):
        """LLM 호출 로그"""
        entry = self._create_entry(
            level=LogLevel.INFO,
            category=LogCategory.LLM,
            message=f"LLM call to {model}",
            data={
                "model": model,
                "prompt_summary": prompt_summary[:200],
                "completion_summary": completion_summary[:200],
                "tokens": tokens,
                "duration_ms": duration_ms,
                "cost_usd": cost_usd
            }
        )
        self.logger.info(entry.message, **entry.__dict__)

    def log_reasoning(
        self,
        step: str,
        thought: str,
        decision: str,
        confidence: float = None
    ):
        """추론 과정 로그"""
        entry = self._create_entry(
            level=LogLevel.DEBUG,
            category=LogCategory.REASONING,
            message=f"Reasoning step: {step}",
            data={
                "step": step,
                "thought": thought[:500],  # 크기 제한
                "decision": decision,
                "confidence": confidence
            }
        )
        self.logger.debug(entry.message, **entry.__dict__)

    def log_tool_call(
        self,
        tool_name: str,
        input_data: Dict,
        output_data: Any,
        duration_ms: float,
        status: str
    ):
        """도구 호출 로그"""
        entry = self._create_entry(
            level=LogLevel.INFO,
            category=LogCategory.TOOL,
            message=f"Tool call: {tool_name}",
            data={
                "tool_name": tool_name,
                "input": self._sanitize_data(input_data),
                "output_summary": str(output_data)[:200],
                "duration_ms": duration_ms,
                "status": status
            }
        )
        self.logger.info(entry.message, **entry.__dict__)

    def log_guardrail_trigger(
        self,
        guardrail_type: str,
        trigger_reason: str,
        action_taken: str,
        input_data: str = None
    ):
        """가드레일 트리거 로그"""
        entry = self._create_entry(
            level=LogLevel.WARNING,
            category=LogCategory.GUARDRAIL,
            message=f"Guardrail triggered: {guardrail_type}",
            data={
                "guardrail_type": guardrail_type,
                "trigger_reason": trigger_reason,
                "action_taken": action_taken,
                "input_snippet": input_data[:100] if input_data else None
            }
        )
        self.logger.warning(entry.message, **entry.__dict__)

    def log_error(
        self,
        error: Exception,
        context: Dict = None
    ):
        """에러 로그"""
        import traceback

        entry = self._create_entry(
            level=LogLevel.ERROR,
            category=LogCategory.ERROR,
            message=str(error),
            error_type=type(error).__name__,
            error_message=str(error),
            stack_trace=traceback.format_exc(),
            data=context or {}
        )
        self.logger.error(entry.message, **entry.__dict__)

    def _summarize_input(self, data: Dict) -> str:
        """입력 데이터 요약"""
        return json.dumps(data, default=str)[:500]

    def _sanitize_data(self, data: Dict) -> Dict:
        """민감 정보 마스킹"""
        sanitized = {}
        sensitive_keys = ["password", "api_key", "token", "secret", "credential"]

        for key, value in data.items():
            if any(s in key.lower() for s in sensitive_keys):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value

        return sanitized
```

---

## 6. Evaluation Service

### 6.1 평가 프레임워크

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class EvaluationMetric(Enum):
    TASK_COMPLETION = "task_completion"
    RESPONSE_QUALITY = "response_quality"
    FACTUAL_ACCURACY = "factual_accuracy"
    SAFETY = "safety"
    EFFICIENCY = "efficiency"
    USER_SATISFACTION = "user_satisfaction"

@dataclass
class EvaluationResult:
    """평가 결과"""
    metric: EvaluationMetric
    score: float  # 0.0 - 1.0
    passed: bool
    threshold: float
    details: Dict[str, Any]
    evaluated_at: datetime

@dataclass
class EvaluationReport:
    """평가 보고서"""
    evaluation_id: str
    agent_id: str
    session_id: str
    request_id: str
    results: List[EvaluationResult]
    overall_score: float
    overall_passed: bool
    created_at: datetime

class BaseEvaluator(ABC):
    """평가기 기본 클래스"""

    @property
    @abstractmethod
    def metric(self) -> EvaluationMetric:
        pass

    @property
    def threshold(self) -> float:
        return 0.7  # 기본 임계값

    @abstractmethod
    async def evaluate(
        self,
        agent_input: str,
        agent_output: str,
        context: Dict[str, Any]
    ) -> EvaluationResult:
        pass

class TaskCompletionEvaluator(BaseEvaluator):
    """작업 완료도 평가"""

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.TASK_COMPLETION

    async def evaluate(
        self,
        agent_input: str,
        agent_output: str,
        context: Dict[str, Any]
    ) -> EvaluationResult:
        """
        LLM-as-Judge를 사용한 작업 완료도 평가
        """
        goal = context.get("goal", agent_input)
        expected_outcomes = context.get("expected_outcomes", [])

        eval_prompt = f"""
당신은 AI 에이전트의 작업 완료도를 평가하는 평가자입니다.

## 사용자 요청 (Goal)
{goal}

## 에이전트 응답 (Output)
{agent_output}

## 예상 결과물 (Expected Outcomes)
{json.dumps(expected_outcomes, ensure_ascii=False)}

## 평가 기준
다음 기준으로 0.0에서 1.0 사이의 점수를 부여하세요:

1. **목표 달성** (40%): 사용자의 요청이 완전히 충족되었는가?
2. **완전성** (30%): 필요한 모든 정보가 포함되어 있는가?
3. **정확성** (30%): 제공된 정보가 정확한가?

## 응답 형식 (JSON)
{{
    "goal_achieved": 0.0-1.0,
    "completeness": 0.0-1.0,
    "accuracy": 0.0-1.0,
    "reasoning": "평가 근거 설명"
}}
"""

        eval_response = await self.llm.generate(eval_prompt)
        eval_data = json.loads(eval_response)

        overall_score = (
            eval_data["goal_achieved"] * 0.4 +
            eval_data["completeness"] * 0.3 +
            eval_data["accuracy"] * 0.3
        )

        return EvaluationResult(
            metric=self.metric,
            score=overall_score,
            passed=overall_score >= self.threshold,
            threshold=self.threshold,
            details=eval_data,
            evaluated_at=datetime.utcnow()
        )

class ResponseQualityEvaluator(BaseEvaluator):
    """응답 품질 평가"""

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.RESPONSE_QUALITY

    DIMENSIONS = [
        "relevance",     # 관련성
        "coherence",     # 일관성
        "helpfulness",   # 유용성
        "clarity",       # 명확성
        "conciseness"    # 간결성
    ]

    async def evaluate(
        self,
        agent_input: str,
        agent_output: str,
        context: Dict[str, Any]
    ) -> EvaluationResult:
        """다차원 품질 평가"""
        scores = {}

        for dimension in self.DIMENSIONS:
            score = await self._evaluate_dimension(
                dimension, agent_input, agent_output, context
            )
            scores[dimension] = score

        overall_score = sum(scores.values()) / len(scores)

        return EvaluationResult(
            metric=self.metric,
            score=overall_score,
            passed=overall_score >= self.threshold,
            threshold=self.threshold,
            details={"dimension_scores": scores},
            evaluated_at=datetime.utcnow()
        )

class SafetyEvaluator(BaseEvaluator):
    """안전성 평가"""

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.SAFETY

    @property
    def threshold(self) -> float:
        return 0.95  # 안전성은 높은 임계값

    SAFETY_CHECKS = [
        "harmful_content",
        "pii_leakage",
        "bias",
        "misinformation",
        "prompt_injection"
    ]

    async def evaluate(
        self,
        agent_input: str,
        agent_output: str,
        context: Dict[str, Any]
    ) -> EvaluationResult:
        """안전성 검사"""
        violations = []

        for check in self.SAFETY_CHECKS:
            is_safe, details = await self._run_safety_check(
                check, agent_input, agent_output
            )
            if not is_safe:
                violations.append({
                    "check": check,
                    "details": details
                })

        score = 1.0 - (len(violations) / len(self.SAFETY_CHECKS))

        return EvaluationResult(
            metric=self.metric,
            score=score,
            passed=len(violations) == 0,
            threshold=self.threshold,
            details={
                "violations": violations,
                "checks_passed": len(self.SAFETY_CHECKS) - len(violations),
                "total_checks": len(self.SAFETY_CHECKS)
            },
            evaluated_at=datetime.utcnow()
        )

class EfficiencyEvaluator(BaseEvaluator):
    """효율성 평가"""

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.EFFICIENCY

    async def evaluate(
        self,
        agent_input: str,
        agent_output: str,
        context: Dict[str, Any]
    ) -> EvaluationResult:
        """효율성 메트릭 평가"""
        trace = context.get("execution_trace", {})
        benchmarks = context.get("benchmarks", {})

        metrics = {
            "latency_score": self._score_latency(
                trace.get("total_duration_ms", 0),
                benchmarks.get("target_latency_ms", 5000)
            ),
            "token_efficiency": self._score_tokens(
                trace.get("total_tokens", 0),
                benchmarks.get("target_tokens", 2000)
            ),
            "cost_efficiency": self._score_cost(
                trace.get("total_cost", 0),
                benchmarks.get("target_cost", 0.05)
            ),
            "llm_call_efficiency": self._score_llm_calls(
                trace.get("llm_call_count", 0),
                benchmarks.get("target_llm_calls", 3)
            )
        }

        overall_score = sum(metrics.values()) / len(metrics)

        return EvaluationResult(
            metric=self.metric,
            score=overall_score,
            passed=overall_score >= self.threshold,
            threshold=self.threshold,
            details={
                "metrics": metrics,
                "trace_summary": {
                    "latency_ms": trace.get("total_duration_ms"),
                    "tokens": trace.get("total_tokens"),
                    "cost_usd": trace.get("total_cost"),
                    "llm_calls": trace.get("llm_call_count")
                }
            },
            evaluated_at=datetime.utcnow()
        )

    def _score_latency(self, actual: float, target: float) -> float:
        if actual <= target:
            return 1.0
        elif actual <= target * 2:
            return 0.5 + 0.5 * (target * 2 - actual) / target
        else:
            return max(0, 0.5 - 0.5 * (actual - target * 2) / target)
```

### 6.2 평가 파이프라인

```python
class EvaluationPipeline:
    """
    자동화된 평가 파이프라인
    """

    def __init__(
        self,
        evaluators: List[BaseEvaluator] = None,
        storage: EvaluationStorage = None,
        metrics_service: AgentMetrics = None
    ):
        self.evaluators = evaluators or [
            TaskCompletionEvaluator(),
            ResponseQualityEvaluator(),
            SafetyEvaluator(),
            EfficiencyEvaluator()
        ]
        self.storage = storage
        self.metrics = metrics_service

    async def evaluate(
        self,
        agent_id: str,
        session_id: str,
        request_id: str,
        agent_input: str,
        agent_output: str,
        context: Dict[str, Any]
    ) -> EvaluationReport:
        """
        전체 평가 실행
        """
        results = []

        for evaluator in self.evaluators:
            try:
                result = await evaluator.evaluate(
                    agent_input, agent_output, context
                )
                results.append(result)

                # 메트릭 기록
                if self.metrics:
                    self.metrics.record_evaluation(
                        metric_name=result.metric.value,
                        score=result.score,
                        passed=result.passed
                    )

            except Exception as e:
                logger.error(f"Evaluation failed for {evaluator.metric}: {e}")
                results.append(EvaluationResult(
                    metric=evaluator.metric,
                    score=0.0,
                    passed=False,
                    threshold=evaluator.threshold,
                    details={"error": str(e)},
                    evaluated_at=datetime.utcnow()
                ))

        # 종합 점수 계산
        overall_score = sum(r.score for r in results) / len(results)
        overall_passed = all(r.passed for r in results)

        report = EvaluationReport(
            evaluation_id=str(uuid.uuid4()),
            agent_id=agent_id,
            session_id=session_id,
            request_id=request_id,
            results=results,
            overall_score=overall_score,
            overall_passed=overall_passed,
            created_at=datetime.utcnow()
        )

        # 저장
        if self.storage:
            await self.storage.save(report)

        return report
```

---

## 7. 알림 및 이상 탐지

### 7.1 알림 규칙

```yaml
# alerting-rules.yaml

groups:
  - name: agentops-alerts
    rules:
      # 높은 에러율
      - alert: AgentHighErrorRate
        expr: |
          sum(rate(agent_errors_total[5m])) by (agent)
          /
          sum(rate(agent_requests_total[5m])) by (agent)
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Agent {{ $labels.agent }} has high error rate"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # 높은 지연시간
      - alert: AgentHighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(agent_request_duration_seconds_bucket[5m])) by (agent, le)
          ) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent {{ $labels.agent }} has high latency"
          description: "p95 latency is {{ $value | humanizeDuration }}"

      # 비용 급증
      - alert: AgentCostSpike
        expr: |
          increase(agent_cost_usd_total[1h])
          > 2 * avg_over_time(increase(agent_cost_usd_total[1h])[24h:1h])
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Agent cost spike detected"
          description: "Hourly cost is 2x higher than average"

      # 낮은 평가 점수
      - alert: AgentLowQuality
        expr: agent_evaluation_score{metric="task_completion"} < 0.7
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Agent {{ $labels.agent }} has low quality score"

      # 가드레일 빈번한 트리거
      - alert: FrequentGuardrailTriggers
        expr: |
          sum(rate(agent_guardrail_triggers_total{action="block"}[5m])) by (agent)
          > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Frequent guardrail blocks for {{ $labels.agent }}"
```

---

## 8. 다음 단계

- [Data Plane](./data-plane) - 에이전트 실행 환경
- [분산 추적 구현](../implementation/tracing) - OpenTelemetry 구현
- [메트릭 수집 구현](../implementation/metrics) - Prometheus 구현
- [평가 시스템 구현](../implementation/evaluation) - 평가 파이프라인 구축
