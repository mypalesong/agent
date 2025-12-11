---
sidebar_position: 2
title: "메트릭 수집"
description: "Prometheus 기반 에이전트 메트릭 수집 및 모니터링"
---

# 메트릭 수집 구현 가이드

Prometheus를 사용하여 AI 에이전트의 성능, 비용, 품질 메트릭을 수집하는 방법을 설명합니다.

---

## 1. 에이전트 메트릭 체계

### 1.1 메트릭 카테고리

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Metrics Categories                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   Performance   │  │      Cost       │  │     Quality     │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Request rate  │  │ • Token usage   │  │ • Eval scores   │         │
│  │ • Latency (p50, │  │ • Cost per req  │  │ • Success rate  │         │
│  │   p95, p99)     │  │ • Daily budget  │  │ • Task complete │         │
│  │ • Error rate    │  │ • Model costs   │  │ • User feedback │         │
│  │ • Throughput    │  │ • Tool costs    │  │ • Accuracy      │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   LLM Metrics   │  │  Tool Metrics   │  │  System Metrics │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Calls/min     │  │ • Call count    │  │ • Active agents │         │
│  │ • Tokens/req    │  │ • Success rate  │  │ • Queue depth   │         │
│  │ • Cache hit     │  │ • Latency       │  │ • Memory usage  │         │
│  │ • Retry count   │  │ • Error types   │  │ • CPU usage     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 메트릭 명명 규칙

```
# Prometheus 메트릭 명명 규칙
#
# Format: agent_<domain>_<metric>_<unit>
#
# Examples:
#   agent_requests_total              - 총 요청 수 (counter)
#   agent_request_duration_seconds    - 요청 지연시간 (histogram)
#   agent_active_sessions             - 활성 세션 수 (gauge)
#   agent_llm_tokens_total            - LLM 토큰 사용량 (counter)
#   agent_cost_usd_total              - 비용 (counter)
```

---

## 2. 메트릭 정의

### 2.1 핵심 메트릭 클래스

```python
# agentops/metrics/definitions.py

from prometheus_client import Counter, Histogram, Gauge, Summary, Info
from typing import List

class AgentMetricsRegistry:
    """
    에이전트 메트릭 레지스트리
    모든 표준 메트릭을 정의하고 관리
    """

    def __init__(self, agent_name: str, agent_version: str):
        self.agent_name = agent_name
        self.agent_version = agent_version
        self._setup_metrics()

    def _setup_metrics(self):
        """메트릭 초기화"""

        # ============================================================
        # REQUEST METRICS
        # ============================================================

        self.requests_total = Counter(
            'agent_requests_total',
            'Total number of agent requests',
            ['agent', 'action', 'status']  # status: success, error, timeout
        )

        self.request_duration_seconds = Histogram(
            'agent_request_duration_seconds',
            'Request duration in seconds',
            ['agent', 'action'],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0]
        )

        self.requests_in_progress = Gauge(
            'agent_requests_in_progress',
            'Number of requests currently being processed',
            ['agent']
        )

        # ============================================================
        # LLM METRICS
        # ============================================================

        self.llm_calls_total = Counter(
            'agent_llm_calls_total',
            'Total LLM API calls',
            ['agent', 'model', 'provider', 'status']
        )

        self.llm_duration_seconds = Histogram(
            'agent_llm_duration_seconds',
            'LLM call duration in seconds',
            ['agent', 'model', 'provider'],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
        )

        self.llm_tokens_total = Counter(
            'agent_llm_tokens_total',
            'Total tokens used',
            ['agent', 'model', 'token_type']  # token_type: prompt, completion
        )

        self.llm_cache_hits_total = Counter(
            'agent_llm_cache_hits_total',
            'LLM response cache hits',
            ['agent', 'model']
        )

        self.llm_retries_total = Counter(
            'agent_llm_retries_total',
            'LLM call retry count',
            ['agent', 'model', 'reason']  # reason: rate_limit, timeout, error
        )

        # ============================================================
        # TOOL METRICS
        # ============================================================

        self.tool_calls_total = Counter(
            'agent_tool_calls_total',
            'Total tool invocations',
            ['agent', 'tool', 'category', 'status']
        )

        self.tool_duration_seconds = Histogram(
            'agent_tool_duration_seconds',
            'Tool execution duration in seconds',
            ['agent', 'tool'],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0]
        )

        self.tool_errors_total = Counter(
            'agent_tool_errors_total',
            'Tool execution errors',
            ['agent', 'tool', 'error_type']
        )

        # ============================================================
        # COST METRICS
        # ============================================================

        self.cost_usd_total = Counter(
            'agent_cost_usd_total',
            'Total cost in USD',
            ['agent', 'model', 'cost_type']  # cost_type: llm, tool, infrastructure
        )

        self.cost_per_request_usd = Summary(
            'agent_cost_per_request_usd',
            'Cost per request in USD',
            ['agent'],
            objectives=[(0.5, 0.05), (0.9, 0.01), (0.99, 0.001)]
        )

        self.token_budget_remaining = Gauge(
            'agent_token_budget_remaining',
            'Remaining token budget',
            ['agent', 'budget_period']  # budget_period: hourly, daily
        )

        # ============================================================
        # QUALITY METRICS
        # ============================================================

        self.evaluation_score = Gauge(
            'agent_evaluation_score',
            'Latest evaluation score (0-1)',
            ['agent', 'metric']  # metric: task_completion, quality, safety, efficiency
        )

        self.evaluation_total = Counter(
            'agent_evaluations_total',
            'Total evaluations performed',
            ['agent', 'metric', 'result']  # result: pass, fail
        )

        self.user_feedback_score = Summary(
            'agent_user_feedback_score',
            'User feedback scores',
            ['agent', 'feedback_type']  # feedback_type: helpful, accurate, fast
        )

        # ============================================================
        # SESSION METRICS
        # ============================================================

        self.active_sessions = Gauge(
            'agent_active_sessions',
            'Number of active sessions',
            ['agent']
        )

        self.session_duration_seconds = Histogram(
            'agent_session_duration_seconds',
            'Session duration in seconds',
            ['agent'],
            buckets=[60, 300, 600, 1800, 3600, 7200, 14400]
        )

        self.session_turns = Histogram(
            'agent_session_turns',
            'Number of conversation turns per session',
            ['agent'],
            buckets=[1, 2, 5, 10, 20, 50, 100]
        )

        # ============================================================
        # GUARDRAIL METRICS
        # ============================================================

        self.guardrail_triggers_total = Counter(
            'agent_guardrail_triggers_total',
            'Guardrail trigger count',
            ['agent', 'guardrail_type', 'direction', 'action']
            # direction: input, output
            # action: block, warn, modify
        )

        self.guardrail_latency_seconds = Histogram(
            'agent_guardrail_latency_seconds',
            'Guardrail check latency',
            ['agent', 'guardrail_type'],
            buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
        )

        # ============================================================
        # ERROR METRICS
        # ============================================================

        self.errors_total = Counter(
            'agent_errors_total',
            'Total errors',
            ['agent', 'error_type', 'severity']  # severity: warning, error, critical
        )

        # ============================================================
        # SYSTEM METRICS
        # ============================================================

        self.agent_info = Info(
            'agent_info',
            'Agent information'
        )
        self.agent_info.info({
            'name': self.agent_name,
            'version': self.agent_version
        })

        self.queue_depth = Gauge(
            'agent_queue_depth',
            'Request queue depth',
            ['agent']
        )
```

### 2.2 메트릭 기록 헬퍼

```python
# agentops/metrics/recorder.py

from contextlib import contextmanager
from typing import Dict, Any, Optional
import time

class MetricsRecorder:
    """
    메트릭 기록 헬퍼 클래스
    """

    def __init__(self, registry: AgentMetricsRegistry):
        self.registry = registry
        self.agent_name = registry.agent_name

    # ==================== Request Metrics ====================

    @contextmanager
    def track_request(self, action: str):
        """
        요청 메트릭 추적

        Usage:
            with metrics.track_request("book_flight"):
                result = await agent.process(request)
        """
        self.registry.requests_in_progress.labels(
            agent=self.agent_name
        ).inc()

        start_time = time.time()
        status = "success"

        try:
            yield
        except Exception as e:
            status = "error"
            raise
        finally:
            duration = time.time() - start_time

            self.registry.requests_total.labels(
                agent=self.agent_name,
                action=action,
                status=status
            ).inc()

            self.registry.request_duration_seconds.labels(
                agent=self.agent_name,
                action=action
            ).observe(duration)

            self.registry.requests_in_progress.labels(
                agent=self.agent_name
            ).dec()

    # ==================== LLM Metrics ====================

    def record_llm_call(
        self,
        model: str,
        provider: str,
        status: str,
        duration: float,
        prompt_tokens: int,
        completion_tokens: int,
        cost: float = None
    ):
        """LLM 호출 메트릭 기록"""
        self.registry.llm_calls_total.labels(
            agent=self.agent_name,
            model=model,
            provider=provider,
            status=status
        ).inc()

        self.registry.llm_duration_seconds.labels(
            agent=self.agent_name,
            model=model,
            provider=provider
        ).observe(duration)

        self.registry.llm_tokens_total.labels(
            agent=self.agent_name,
            model=model,
            token_type="prompt"
        ).inc(prompt_tokens)

        self.registry.llm_tokens_total.labels(
            agent=self.agent_name,
            model=model,
            token_type="completion"
        ).inc(completion_tokens)

        if cost is not None:
            self.registry.cost_usd_total.labels(
                agent=self.agent_name,
                model=model,
                cost_type="llm"
            ).inc(cost)

    def record_llm_cache_hit(self, model: str):
        """LLM 캐시 히트 기록"""
        self.registry.llm_cache_hits_total.labels(
            agent=self.agent_name,
            model=model
        ).inc()

    def record_llm_retry(self, model: str, reason: str):
        """LLM 재시도 기록"""
        self.registry.llm_retries_total.labels(
            agent=self.agent_name,
            model=model,
            reason=reason
        ).inc()

    # ==================== Tool Metrics ====================

    @contextmanager
    def track_tool_call(self, tool: str, category: str = "general"):
        """
        도구 호출 메트릭 추적

        Usage:
            with metrics.track_tool_call("web_search", "search"):
                result = await tool.execute()
        """
        start_time = time.time()
        status = "success"

        try:
            yield
        except Exception as e:
            status = "error"
            self.registry.tool_errors_total.labels(
                agent=self.agent_name,
                tool=tool,
                error_type=type(e).__name__
            ).inc()
            raise
        finally:
            duration = time.time() - start_time

            self.registry.tool_calls_total.labels(
                agent=self.agent_name,
                tool=tool,
                category=category,
                status=status
            ).inc()

            self.registry.tool_duration_seconds.labels(
                agent=self.agent_name,
                tool=tool
            ).observe(duration)

    # ==================== Quality Metrics ====================

    def record_evaluation(
        self,
        metric: str,
        score: float,
        passed: bool
    ):
        """평가 메트릭 기록"""
        self.registry.evaluation_score.labels(
            agent=self.agent_name,
            metric=metric
        ).set(score)

        self.registry.evaluation_total.labels(
            agent=self.agent_name,
            metric=metric,
            result="pass" if passed else "fail"
        ).inc()

    def record_user_feedback(
        self,
        feedback_type: str,
        score: float
    ):
        """사용자 피드백 기록"""
        self.registry.user_feedback_score.labels(
            agent=self.agent_name,
            feedback_type=feedback_type
        ).observe(score)

    # ==================== Guardrail Metrics ====================

    @contextmanager
    def track_guardrail(
        self,
        guardrail_type: str,
        direction: str = "input"
    ):
        """
        가드레일 검사 메트릭 추적

        Usage:
            with metrics.track_guardrail("pii_detection", "input"):
                result = await guardrail.check(input)
        """
        start_time = time.time()

        try:
            yield
        finally:
            duration = time.time() - start_time
            self.registry.guardrail_latency_seconds.labels(
                agent=self.agent_name,
                guardrail_type=guardrail_type
            ).observe(duration)

    def record_guardrail_trigger(
        self,
        guardrail_type: str,
        direction: str,
        action: str
    ):
        """가드레일 트리거 기록"""
        self.registry.guardrail_triggers_total.labels(
            agent=self.agent_name,
            guardrail_type=guardrail_type,
            direction=direction,
            action=action
        ).inc()

    # ==================== Session Metrics ====================

    def session_started(self):
        """세션 시작"""
        self.registry.active_sessions.labels(
            agent=self.agent_name
        ).inc()

    def session_ended(self, duration_seconds: float, turns: int):
        """세션 종료"""
        self.registry.active_sessions.labels(
            agent=self.agent_name
        ).dec()

        self.registry.session_duration_seconds.labels(
            agent=self.agent_name
        ).observe(duration_seconds)

        self.registry.session_turns.labels(
            agent=self.agent_name
        ).observe(turns)

    # ==================== Cost Metrics ====================

    def record_request_cost(self, cost: float):
        """요청당 비용 기록"""
        self.registry.cost_per_request_usd.labels(
            agent=self.agent_name
        ).observe(cost)

    def update_budget_remaining(
        self,
        budget_period: str,
        remaining: float
    ):
        """남은 예산 업데이트"""
        self.registry.token_budget_remaining.labels(
            agent=self.agent_name,
            budget_period=budget_period
        ).set(remaining)

    # ==================== Error Metrics ====================

    def record_error(
        self,
        error_type: str,
        severity: str = "error"
    ):
        """에러 기록"""
        self.registry.errors_total.labels(
            agent=self.agent_name,
            error_type=error_type,
            severity=severity
        ).inc()
```

---

## 3. 메트릭 서버 설정

### 3.1 HTTP 서버 설정

```python
# agentops/metrics/server.py

from prometheus_client import start_http_server, generate_latest, CONTENT_TYPE_LATEST
from aiohttp import web
import asyncio

class MetricsServer:
    """
    Prometheus 메트릭 HTTP 서버
    """

    def __init__(self, port: int = 9090, path: str = "/metrics"):
        self.port = port
        self.path = path
        self._app = None
        self._runner = None

    async def start(self):
        """비동기 메트릭 서버 시작"""
        self._app = web.Application()
        self._app.router.add_get(self.path, self._handle_metrics)
        self._app.router.add_get("/health", self._handle_health)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()

        site = web.TCPSite(self._runner, "0.0.0.0", self.port)
        await site.start()

        print(f"Metrics server started on port {self.port}")

    async def stop(self):
        """서버 중지"""
        if self._runner:
            await self._runner.cleanup()

    async def _handle_metrics(self, request: web.Request) -> web.Response:
        """메트릭 엔드포인트 핸들러"""
        metrics = generate_latest()
        return web.Response(
            body=metrics,
            content_type=CONTENT_TYPE_LATEST
        )

    async def _handle_health(self, request: web.Request) -> web.Response:
        """헬스 체크 엔드포인트"""
        return web.json_response({"status": "healthy"})


# FastAPI 통합
from fastapi import FastAPI, Response

def setup_metrics_endpoint(app: FastAPI, path: str = "/metrics"):
    """FastAPI 앱에 메트릭 엔드포인트 추가"""

    @app.get(path)
    async def metrics():
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
```

### 3.2 Kubernetes ServiceMonitor

```yaml
# servicemonitor.yaml

apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agentops-monitor
  labels:
    app: agentops
spec:
  selector:
    matchLabels:
      app: agent-runtime
  endpoints:
    - port: metrics
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
  namespaceSelector:
    matchNames:
      - agentops
```

---

## 4. Grafana 대시보드

### 4.1 개요 대시보드

```json
{
  "title": "AgentOps Overview",
  "uid": "agentops-overview",
  "panels": [
    {
      "title": "Request Rate",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
      "targets": [{
        "expr": "sum(rate(agent_requests_total[5m])) by (agent)",
        "legendFormat": "{{agent}}"
      }]
    },
    {
      "title": "Error Rate (%)",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
      "targets": [{
        "expr": "sum(rate(agent_requests_total{status='error'}[5m])) by (agent) / sum(rate(agent_requests_total[5m])) by (agent) * 100",
        "legendFormat": "{{agent}}"
      }]
    },
    {
      "title": "Latency P95",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
      "targets": [{
        "expr": "histogram_quantile(0.95, sum(rate(agent_request_duration_seconds_bucket[5m])) by (agent, le))",
        "legendFormat": "{{agent}}"
      }]
    },
    {
      "title": "Active Sessions",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8},
      "targets": [{
        "expr": "sum(agent_active_sessions)"
      }]
    },
    {
      "title": "Hourly Cost ($)",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 18, "y": 8},
      "targets": [{
        "expr": "sum(increase(agent_cost_usd_total[1h]))"
      }],
      "options": {
        "colorMode": "value"
      }
    }
  ]
}
```

### 4.2 LLM 메트릭 대시보드

```json
{
  "title": "AgentOps LLM Metrics",
  "panels": [
    {
      "title": "LLM Calls by Model",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(rate(agent_llm_calls_total[5m])) by (model)",
        "legendFormat": "{{model}}"
      }]
    },
    {
      "title": "Token Usage",
      "type": "timeseries",
      "targets": [
        {
          "expr": "sum(rate(agent_llm_tokens_total{token_type='prompt'}[5m])) by (model)",
          "legendFormat": "{{model}} - prompt"
        },
        {
          "expr": "sum(rate(agent_llm_tokens_total{token_type='completion'}[5m])) by (model)",
          "legendFormat": "{{model}} - completion"
        }
      ]
    },
    {
      "title": "LLM Latency by Model",
      "type": "heatmap",
      "targets": [{
        "expr": "sum(rate(agent_llm_duration_seconds_bucket[5m])) by (model, le)",
        "legendFormat": "{{model}}"
      }]
    },
    {
      "title": "Cost by Model",
      "type": "piechart",
      "targets": [{
        "expr": "sum(agent_cost_usd_total) by (model)",
        "legendFormat": "{{model}}"
      }]
    },
    {
      "title": "Cache Hit Rate",
      "type": "gauge",
      "targets": [{
        "expr": "sum(rate(agent_llm_cache_hits_total[1h])) / sum(rate(agent_llm_calls_total[1h])) * 100"
      }],
      "options": {
        "thresholds": [
          {"value": 0, "color": "red"},
          {"value": 30, "color": "yellow"},
          {"value": 60, "color": "green"}
        ]
      }
    }
  ]
}
```

---

## 5. 알림 규칙

### 5.1 Prometheus 알림 규칙

```yaml
# prometheus-rules.yaml

groups:
  - name: agentops.rules
    rules:
      # 높은 에러율 알림
      - alert: AgentHighErrorRate
        expr: |
          (
            sum(rate(agent_requests_total{status="error"}[5m])) by (agent)
            /
            sum(rate(agent_requests_total[5m])) by (agent)
          ) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate for agent {{ $labels.agent }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # 높은 지연시간 알림
      - alert: AgentHighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(agent_request_duration_seconds_bucket[5m])) by (agent, le)
          ) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency for agent {{ $labels.agent }}"
          description: "P95 latency is {{ $value | humanizeDuration }}"

      # 비용 급증 알림
      - alert: AgentCostSpike
        expr: |
          increase(agent_cost_usd_total[1h])
          >
          2 * avg_over_time(increase(agent_cost_usd_total[1h])[24h:1h])
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Cost spike detected"
          description: "Hourly cost is 2x higher than 24h average"

      # 낮은 품질 점수 알림
      - alert: AgentLowQuality
        expr: |
          agent_evaluation_score{metric="task_completion"} < 0.7
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Low quality score for {{ $labels.agent }}"
          description: "Task completion score is {{ $value }}"

      # LLM API 에러 급증
      - alert: LLMHighErrorRate
        expr: |
          sum(rate(agent_llm_calls_total{status="error"}[5m])) by (model, provider)
          /
          sum(rate(agent_llm_calls_total[5m])) by (model, provider)
          > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High LLM error rate for {{ $labels.provider }}/{{ $labels.model }}"

      # 가드레일 빈번한 트리거
      - alert: FrequentGuardrailBlocks
        expr: |
          sum(rate(agent_guardrail_triggers_total{action="block"}[5m])) by (agent, guardrail_type) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Frequent guardrail blocks"
          description: "{{ $labels.guardrail_type }} is blocking frequently"

      # 예산 소진 임박
      - alert: BudgetNearlyExhausted
        expr: |
          agent_token_budget_remaining{budget_period="daily"} < 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Daily token budget nearly exhausted"
          description: "Only {{ $value }} tokens remaining"
```

---

## 6. 다음 단계

- [구조화 로깅](./logging) - 로그 수집 시스템
- [평가 시스템](./evaluation) - 품질 평가 파이프라인
- [비용 최적화](../best-practices/cost-optimization) - 비용 관리 전략
