---
sidebar_position: 1
title: "AgentOps: 에이전트 운영의 새로운 패러다임"
description: "AI 에이전트의 배포, 모니터링, 관리를 위한 운영 체계"
---

# AgentOps: 에이전트 운영의 새로운 패러다임

![AgentOps Dashboard](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80)

*Figure: Modern AI Operations - Monitoring, Observability, and Control*

> "DevOps가 소프트웨어 개발을 혁신했듯이, AgentOps는 AI 에이전트 시대의 운영 표준이 될 것이다."

---

## 1. AgentOps 개요

### 1.1 정의

**AgentOps**는 AI 에이전트의 전체 생명주기를 관리하기 위한 **운영 방법론, 도구, 그리고 모범 사례**의 집합이다.

```
AgentOps = Agent Operations
         = 에이전트의 개발, 배포, 모니터링, 최적화, 거버넌스
```

### 1.2 왜 AgentOps가 필요한가?

기존 소프트웨어와 달리, AI 에이전트는 **비결정적(non-deterministic)** 행동을 보인다:

| 특성 | 기존 소프트웨어 | AI 에이전트 |
|------|---------------|------------|
| 동작 예측 | 결정적 | 확률적 |
| 출력 일관성 | 동일 입력 → 동일 출력 | 동일 입력 → 다양한 출력 |
| 디버깅 | 스택 트레이스 | 추론 과정 분석 |
| 테스트 | 단위/통합 테스트 | 행동 기반 평가 |
| 비용 | 고정적 | 사용량 기반 (토큰) |
| 실패 모드 | 명확한 에러 | 미묘한 품질 저하 |

### 1.3 AgentOps 성숙도 모델

```
┌─────────────────────────────────────────────────────────────┐
│                  AgentOps Maturity Model                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Level 5: Autonomous                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 자율 최적화 | 예측적 관리 | 완전 자동화               │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                  │
│  Level 4: Optimized                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 성능 최적화 | A/B 테스팅 | 비용 최적화                │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                  │
│  Level 3: Measured                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 종합 모니터링 | 품질 메트릭 | 알림 체계                │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                  │
│  Level 2: Managed                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 기본 로깅 | 수동 모니터링 | CI/CD 파이프라인          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                  │
│  Level 1: Initial                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 수동 배포 | 로깅 없음 | 반응적 대응                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AgentOps 핵심 구성 요소

### 2.1 전체 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                       AgentOps Platform                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Control Plane                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │ Registry │ │ Config   │ │ Policy   │ │ Secrets  │       │ │
│  │  │ Service  │ │ Manager  │ │ Engine   │ │ Vault    │       │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↕                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Observability Layer                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │ Tracing  │ │ Metrics  │ │ Logging  │ │ Eval     │       │ │
│  │  │ (Traces) │ │ (Stats)  │ │ (Logs)   │ │ (Evals)  │       │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↕                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Data Plane                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │ Agent 1  │ │ Agent 2  │ │ Agent 3  │ │ Agent N  │       │ │
│  │  │ Instance │ │ Instance │ │ Instance │ │ Instance │       │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 핵심 기능

| 영역 | 기능 | 설명 |
|------|------|------|
| **Tracing** | 분산 추적 | 에이전트 행동의 전체 궤적 추적 |
| **Metrics** | 성능 지표 | 지연 시간, 토큰 사용량, 성공률 |
| **Logging** | 구조화 로깅 | 추론 과정, 도구 호출, 결정 로그 |
| **Evaluation** | 품질 평가 | 응답 품질, 목표 달성률 |
| **Cost** | 비용 관리 | 토큰 비용 추적 및 최적화 |
| **Security** | 보안 감사 | 접근 제어, 민감 데이터 처리 |

---

## 3. 관찰 가능성 (Observability)

### 3.1 분산 추적 (Distributed Tracing)

에이전트의 모든 행동을 추적하는 것은 AgentOps의 핵심이다:

```python
# OpenTelemetry 기반 에이전트 추적
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from agentops import AgentTracer

# 트레이서 설정
tracer_provider = TracerProvider()
trace.set_tracer_provider(tracer_provider)
agent_tracer = AgentTracer()

class TracedAgent:
    def __init__(self, name: str):
        self.name = name
        self.tracer = trace.get_tracer("agent." + name)

    @agent_tracer.trace_action
    async def process_request(self, request: dict) -> dict:
        """
        요청 처리 - 자동으로 추적됨
        """
        with self.tracer.start_as_current_span("process_request") as span:
            span.set_attribute("agent.name", self.name)
            span.set_attribute("request.type", request.get("type"))

            # 1. 추론 단계
            with self.tracer.start_span("reasoning") as reason_span:
                thought = await self.reason(request)
                reason_span.set_attribute("thought.length", len(thought))

            # 2. 도구 호출
            with self.tracer.start_span("tool_execution") as tool_span:
                tool_result = await self.execute_tool(thought)
                tool_span.set_attribute("tool.name", tool_result.tool_name)
                tool_span.set_attribute("tool.success", tool_result.success)

            # 3. 응답 생성
            with self.tracer.start_span("response_generation"):
                response = await self.generate_response(tool_result)

            span.set_attribute("response.success", True)
            return response
```

### 3.2 추적 시각화

```
Trace: user_request_12345
├── [Agent: Orchestrator] process_request (250ms)
│   ├── [Span] reasoning (45ms)
│   │   └── LLM call: gpt-4 (40ms, 150 tokens)
│   │
│   ├── [Span] tool_selection (5ms)
│   │
│   ├── [Span] delegate_to_specialist (180ms)
│   │   │
│   │   └── [Agent: FlightAgent] search_flights (175ms)
│   │       ├── [Span] parse_request (3ms)
│   │       ├── [Span] api_call: amadeus (120ms)
│   │       │   └── HTTP GET /flights (115ms)
│   │       ├── [Span] filter_results (8ms)
│   │       └── [Span] format_response (4ms)
│   │
│   └── [Span] response_generation (20ms)
│       └── LLM call: gpt-4 (18ms, 80 tokens)
```

### 3.3 메트릭 수집

```python
from dataclasses import dataclass
from typing import Dict, List
from datetime import datetime
import prometheus_client as prom

# 메트릭 정의
class AgentMetrics:
    """에이전트 성능 메트릭"""

    def __init__(self, agent_name: str):
        self.agent_name = agent_name

        # 요청 메트릭
        self.request_counter = prom.Counter(
            'agent_requests_total',
            'Total number of requests',
            ['agent', 'action', 'status']
        )

        self.request_latency = prom.Histogram(
            'agent_request_duration_seconds',
            'Request latency in seconds',
            ['agent', 'action'],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
        )

        # 토큰 사용량
        self.token_counter = prom.Counter(
            'agent_tokens_total',
            'Total tokens used',
            ['agent', 'model', 'type']  # type: input/output
        )

        # 도구 호출
        self.tool_calls = prom.Counter(
            'agent_tool_calls_total',
            'Total tool calls',
            ['agent', 'tool', 'status']
        )

        # 에러
        self.error_counter = prom.Counter(
            'agent_errors_total',
            'Total errors',
            ['agent', 'error_type']
        )

        # 비용
        self.cost_counter = prom.Counter(
            'agent_cost_dollars',
            'Total cost in USD',
            ['agent', 'model']
        )

    def record_request(self,
                       action: str,
                       status: str,
                       duration: float,
                       tokens: Dict[str, int],
                       model: str):
        """요청 메트릭 기록"""
        self.request_counter.labels(
            agent=self.agent_name,
            action=action,
            status=status
        ).inc()

        self.request_latency.labels(
            agent=self.agent_name,
            action=action
        ).observe(duration)

        for token_type, count in tokens.items():
            self.token_counter.labels(
                agent=self.agent_name,
                model=model,
                type=token_type
            ).inc(count)

        # 비용 계산 (예: GPT-4 기준)
        cost = self._calculate_cost(tokens, model)
        self.cost_counter.labels(
            agent=self.agent_name,
            model=model
        ).inc(cost)

    def _calculate_cost(self,
                       tokens: Dict[str, int],
                       model: str) -> float:
        """토큰 비용 계산"""
        pricing = {
            "gpt-4": {"input": 0.03/1000, "output": 0.06/1000},
            "gpt-4-turbo": {"input": 0.01/1000, "output": 0.03/1000},
            "claude-3-opus": {"input": 0.015/1000, "output": 0.075/1000},
            "claude-3-sonnet": {"input": 0.003/1000, "output": 0.015/1000},
        }
        rates = pricing.get(model, {"input": 0.01/1000, "output": 0.03/1000})
        return (
            tokens.get("input", 0) * rates["input"] +
            tokens.get("output", 0) * rates["output"]
        )
```

### 3.4 대시보드 구성

```yaml
# Grafana 대시보드 설정 예시
# agentops-dashboard.yaml

dashboard:
  title: "AgentOps Dashboard"
  refresh: "10s"

  rows:
    - title: "Overview"
      panels:
        - title: "Request Rate"
          type: graph
          targets:
            - expr: rate(agent_requests_total[5m])
              legendFormat: "{{ "{{agent}}" }} - {{ "{{action}}" }}"

        - title: "Latency (p95)"
          type: graph
          targets:
            - expr: histogram_quantile(0.95, rate(agent_request_duration_seconds_bucket[5m]))
              legendFormat: "{{ "{{agent}}" }}"

        - title: "Error Rate"
          type: graph
          targets:
            - expr: rate(agent_errors_total[5m]) / rate(agent_requests_total[5m])
              legendFormat: "{{ "{{agent}}" }}"

    - title: "Costs"
      panels:
        - title: "Hourly Cost"
          type: stat
          targets:
            - expr: increase(agent_cost_dollars[1h])

        - title: "Token Usage"
          type: graph
          targets:
            - expr: rate(agent_tokens_total[5m])
              legendFormat: "{{ "{{model}}" }} - {{ "{{type}}" }}"

        - title: "Cost by Agent"
          type: piechart
          targets:
            - expr: sum(agent_cost_dollars) by (agent)

    - title: "Quality"
      panels:
        - title: "Success Rate"
          type: gauge
          targets:
            - expr: sum(rate(agent_requests_total{status="success"}[1h])) / sum(rate(agent_requests_total[1h]))

        - title: "Evaluation Scores"
          type: graph
          targets:
            - expr: agent_evaluation_score
              legendFormat: "{{ "{{agent}}" }} - {{ "{{metric}}" }}"
```

---

## 4. 에이전트 평가 (Evaluation)

### 4.1 평가 프레임워크

AI 에이전트 평가는 전통적인 소프트웨어 테스트와 근본적으로 다르다:

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class EvaluationResult:
    metric_name: str
    score: float  # 0.0 ~ 1.0
    details: Dict
    timestamp: str

class AgentEvaluator(ABC):
    """에이전트 평가기 기본 클래스"""

    @abstractmethod
    async def evaluate(self,
                       agent_output: str,
                       context: Dict) -> EvaluationResult:
        pass


class TaskCompletionEvaluator(AgentEvaluator):
    """작업 완료도 평가"""

    async def evaluate(self,
                       agent_output: str,
                       context: Dict) -> EvaluationResult:
        """
        목표 달성 여부 평가
        """
        goal = context["goal"]
        expected_outcomes = context["expected_outcomes"]

        # LLM을 사용한 평가
        evaluation_prompt = f"""
        ## 작업 완료도 평가

        목표: {goal}
        에이전트 출력: {agent_output}
        예상 결과물: {expected_outcomes}

        다음 기준으로 평가하세요:
        1. 목표 달성 여부 (0-1)
        2. 결과의 완전성 (0-1)
        3. 결과의 정확성 (0-1)

        JSON 형식으로 응답:
        {{"goal_achieved": 0.0-1.0, "completeness": 0.0-1.0, "accuracy": 0.0-1.0, "reasoning": "..."}}
        """

        eval_response = await self.llm.generate(evaluation_prompt)
        eval_data = json.loads(eval_response)

        # 종합 점수 계산
        overall_score = (
            eval_data["goal_achieved"] * 0.4 +
            eval_data["completeness"] * 0.3 +
            eval_data["accuracy"] * 0.3
        )

        return EvaluationResult(
            metric_name="task_completion",
            score=overall_score,
            details=eval_data,
            timestamp=datetime.now().isoformat()
        )


class ResponseQualityEvaluator(AgentEvaluator):
    """응답 품질 평가"""

    QUALITY_DIMENSIONS = [
        "relevance",      # 관련성
        "coherence",      # 일관성
        "helpfulness",    # 유용성
        "safety",         # 안전성
        "factuality",     # 사실 정확성
    ]

    async def evaluate(self,
                       agent_output: str,
                       context: Dict) -> EvaluationResult:
        scores = {}

        for dimension in self.QUALITY_DIMENSIONS:
            score = await self._evaluate_dimension(
                dimension, agent_output, context
            )
            scores[dimension] = score

        overall = sum(scores.values()) / len(scores)

        return EvaluationResult(
            metric_name="response_quality",
            score=overall,
            details={"dimension_scores": scores},
            timestamp=datetime.now().isoformat()
        )


class EfficiencyEvaluator(AgentEvaluator):
    """효율성 평가"""

    async def evaluate(self,
                       agent_output: str,
                       context: Dict) -> EvaluationResult:
        execution_trace = context["execution_trace"]

        metrics = {
            "total_latency": execution_trace["total_duration_ms"],
            "llm_calls": execution_trace["llm_call_count"],
            "tool_calls": execution_trace["tool_call_count"],
            "tokens_used": execution_trace["total_tokens"],
            "cost": execution_trace["total_cost"],
            "retries": execution_trace["retry_count"],
        }

        # 효율성 점수 계산 (벤치마크 대비)
        benchmarks = context.get("benchmarks", {})
        efficiency_score = self._calculate_efficiency_score(
            metrics, benchmarks
        )

        return EvaluationResult(
            metric_name="efficiency",
            score=efficiency_score,
            details={"metrics": metrics},
            timestamp=datetime.now().isoformat()
        )
```

### 4.2 평가 파이프라인

```python
class EvaluationPipeline:
    """
    자동화된 평가 파이프라인
    """

    def __init__(self):
        self.evaluators = [
            TaskCompletionEvaluator(),
            ResponseQualityEvaluator(),
            EfficiencyEvaluator(),
            SafetyEvaluator(),
        ]

    async def run_evaluation(self,
                            agent: Agent,
                            test_suite: TestSuite) -> EvaluationReport:
        """
        전체 평가 실행
        """
        results = []

        for test_case in test_suite.cases:
            # 에이전트 실행
            output = await agent.run(test_case.input)

            # 실행 추적 수집
            trace = agent.get_last_trace()

            # 모든 평가기 실행
            context = {
                "goal": test_case.goal,
                "expected_outcomes": test_case.expected,
                "execution_trace": trace,
                "benchmarks": test_suite.benchmarks,
            }

            case_results = []
            for evaluator in self.evaluators:
                result = await evaluator.evaluate(output, context)
                case_results.append(result)

            results.append({
                "test_case": test_case.id,
                "evaluations": case_results
            })

        return self._generate_report(results)

    def _generate_report(self, results: List) -> EvaluationReport:
        """평가 보고서 생성"""
        # 메트릭별 집계
        aggregated = {}
        for result in results:
            for eval_result in result["evaluations"]:
                metric = eval_result.metric_name
                if metric not in aggregated:
                    aggregated[metric] = []
                aggregated[metric].append(eval_result.score)

        summary = {
            metric: {
                "mean": sum(scores) / len(scores),
                "min": min(scores),
                "max": max(scores),
            }
            for metric, scores in aggregated.items()
        }

        return EvaluationReport(
            timestamp=datetime.now().isoformat(),
            summary=summary,
            detailed_results=results,
        )
```

---

## 5. 배포 및 스케일링

### 5.1 배포 아키텍처

```yaml
# Kubernetes 배포 설정
# agent-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: travel-orchestrator-agent
  labels:
    app: travel-orchestrator
    agentops.io/type: orchestrator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: travel-orchestrator
  template:
    metadata:
      labels:
        app: travel-orchestrator
      annotations:
        agentops.io/trace: "true"
        agentops.io/metrics: "true"
    spec:
      containers:
      - name: agent
        image: agents/travel-orchestrator:v2.1.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: AGENT_NAME
          value: "travel-orchestrator"
        - name: LLM_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-credentials
              key: api-key
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://otel-collector:4317"
        - name: AGENTOPS_ENABLED
          value: "true"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: travel-orchestrator-service
spec:
  selector:
    app: travel-orchestrator
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: travel-orchestrator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: travel-orchestrator-agent
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: agent_request_queue_length
      target:
        type: AverageValue
        averageValue: "50"
```

### 5.2 CI/CD 파이프라인

```yaml
# GitHub Actions CI/CD
# .github/workflows/agent-deploy.yaml

name: Agent CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run unit tests
        run: pytest tests/unit -v

      - name: Run integration tests
        run: pytest tests/integration -v

  evaluate:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup evaluation environment
        run: |
          pip install agentops-eval

      - name: Run agent evaluation
        env:
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
        run: |
          agentops eval run \
            --agent ./src/agent.py \
            --test-suite ./tests/eval/test_suite.yaml \
            --output ./eval_results.json

      - name: Check quality gates
        run: |
          agentops eval check \
            --results ./eval_results.json \
            --min-task-completion 0.85 \
            --min-response-quality 0.80 \
            --max-cost-per-request 0.05

      - name: Upload evaluation results
        uses: actions/upload-artifact@v3
        with:
          name: evaluation-results
          path: eval_results.json

  deploy:
    needs: evaluate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t agents/travel-orchestrator:${{ github.sha }} .
          docker push agents/travel-orchestrator:${{ github.sha }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/travel-orchestrator-agent \
            agent=agents/travel-orchestrator:${{ github.sha }}

      - name: Verify deployment
        run: |
          kubectl rollout status deployment/travel-orchestrator-agent

      - name: Run smoke tests
        run: |
          agentops test smoke \
            --endpoint https://travel-agent.example.com \
            --timeout 60
```

---

## 6. 비용 최적화

### 6.1 비용 모니터링

```python
class CostOptimizer:
    """
    에이전트 비용 최적화 도구
    """

    def __init__(self):
        self.token_costs = {
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
            "claude-3-opus": {"input": 0.015, "output": 0.075},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
        }

    def analyze_usage(self,
                     traces: List[Trace],
                     time_range: str = "7d") -> CostAnalysis:
        """사용량 분석"""
        analysis = {
            "total_cost": 0,
            "by_model": {},
            "by_agent": {},
            "by_action": {},
            "optimization_opportunities": []
        }

        for trace in traces:
            for span in trace.spans:
                if span.type == "llm_call":
                    cost = self._calculate_span_cost(span)
                    analysis["total_cost"] += cost

                    # 모델별 집계
                    model = span.attributes["model"]
                    analysis["by_model"][model] = \
                        analysis["by_model"].get(model, 0) + cost

                    # 에이전트별 집계
                    agent = span.attributes["agent"]
                    analysis["by_agent"][agent] = \
                        analysis["by_agent"].get(agent, 0) + cost

        # 최적화 기회 식별
        analysis["optimization_opportunities"] = \
            self._identify_optimizations(analysis)

        return CostAnalysis(**analysis)

    def _identify_optimizations(self,
                               analysis: Dict) -> List[Optimization]:
        """비용 최적화 기회 식별"""
        opportunities = []

        # 1. 모델 다운그레이드 기회
        for model, cost in analysis["by_model"].items():
            if model in ["gpt-4", "claude-3-opus"]:
                # 단순 작업에 고가 모델 사용 식별
                simple_tasks_cost = self._get_simple_tasks_cost(model)
                if simple_tasks_cost > cost * 0.3:
                    opportunities.append(Optimization(
                        type="model_downgrade",
                        description="Consider using smaller model for simple tasks currently using " + model,
                        potential_savings=simple_tasks_cost * 0.8,
                        priority="high"
                    ))

        # 2. 캐싱 기회
        cache_opportunities = self._identify_cache_opportunities()
        opportunities.extend(cache_opportunities)

        # 3. 프롬프트 최적화
        prompt_opportunities = self._identify_prompt_optimizations()
        opportunities.extend(prompt_opportunities)

        return opportunities

    def suggest_model_routing(self,
                             request: Request) -> ModelRecommendation:
        """
        요청 복잡도에 따른 모델 라우팅 제안
        """
        complexity = self._assess_complexity(request)

        if complexity < 0.3:
            return ModelRecommendation(
                model="gpt-3.5-turbo",
                reason="Simple task - cost efficient model sufficient"
            )
        elif complexity < 0.7:
            return ModelRecommendation(
                model="claude-3-sonnet",
                reason="Moderate complexity - balanced performance/cost"
            )
        else:
            return ModelRecommendation(
                model="claude-3-opus",
                reason="High complexity - requires advanced reasoning"
            )
```

### 6.2 캐싱 전략

```python
from functools import lru_cache
import hashlib
import redis

class AgentCache:
    """
    에이전트 응답 캐싱
    """

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.ttl_config = {
            "static_facts": 86400 * 7,    # 7일
            "search_results": 3600,        # 1시간
            "embeddings": 86400 * 30,      # 30일
            "llm_responses": 3600 * 4,     # 4시간
        }

    async def get_or_compute(self,
                            cache_type: str,
                            key_data: Dict,
                            compute_fn: Callable) -> Any:
        """캐시 확인 후 없으면 계산"""
        cache_key = self._generate_key(cache_type, key_data)

        # 캐시 확인
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # 계산 실행
        result = await compute_fn()

        # 캐시 저장
        ttl = self.ttl_config.get(cache_type, 3600)
        await self.redis.setex(
            cache_key,
            ttl,
            json.dumps(result)
        )

        return result

    def _generate_key(self, cache_type: str, key_data: Dict) -> str:
        """캐시 키 생성"""
        data_str = json.dumps(key_data, sort_keys=True)
        hash_val = hashlib.sha256(data_str.encode()).hexdigest()[:16]
        return "agent:cache:" + cache_type + ":" + hash_val


# 시맨틱 캐싱 (유사한 쿼리에 대한 캐시 재사용)
class SemanticCache:
    """
    임베딩 기반 시맨틱 캐싱
    유사한 질문에 대해 캐시된 응답 재사용
    """

    def __init__(self, similarity_threshold: float = 0.95):
        self.threshold = similarity_threshold
        self.embedding_model = EmbeddingModel()
        self.cache = VectorStore()

    async def get_similar(self, query: str) -> Optional[CachedResponse]:
        """유사한 쿼리의 캐시 응답 검색"""
        query_embedding = await self.embedding_model.embed(query)

        results = await self.cache.search(
            query_embedding,
            top_k=1,
            threshold=self.threshold
        )

        if results:
            return results[0].metadata["response"]
        return None

    async def store(self, query: str, response: str):
        """쿼리-응답 쌍 캐시 저장"""
        embedding = await self.embedding_model.embed(query)
        await self.cache.insert(
            embedding,
            metadata={"query": query, "response": response}
        )
```

---

## 7. 안전성 및 거버넌스

### 7.1 가드레일 시스템

```python
class AgentGuardrails:
    """
    에이전트 행동 제약 시스템
    """

    def __init__(self):
        self.input_validators = []
        self.output_validators = []
        self.action_policies = []

    async def validate_input(self, input_data: Dict) -> ValidationResult:
        """입력 검증"""
        for validator in self.input_validators:
            result = await validator.validate(input_data)
            if not result.valid:
                return result
        return ValidationResult(valid=True)

    async def validate_output(self, output: str) -> ValidationResult:
        """출력 검증"""
        checks = [
            self._check_pii_leakage(output),
            self._check_harmful_content(output),
            self._check_hallucination(output),
            self._check_bias(output),
        ]

        results = await asyncio.gather(*checks)

        for result in results:
            if not result.valid:
                return result

        return ValidationResult(valid=True)

    async def enforce_policy(self,
                            action: Action,
                            context: Dict) -> PolicyDecision:
        """정책 강제"""
        for policy in self.action_policies:
            decision = await policy.evaluate(action, context)
            if decision.deny:
                return decision

        return PolicyDecision(allow=True)

    async def _check_pii_leakage(self, output: str) -> ValidationResult:
        """개인정보 유출 검사"""
        pii_patterns = [
            r'\b\d{6}-\d{7}\b',  # 주민등록번호
            r'\b\d{3}-\d{4}-\d{4}\b',  # 전화번호
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # 이메일
        ]

        for pattern in pii_patterns:
            if re.search(pattern, output):
                return ValidationResult(
                    valid=False,
                    reason="PII detected in output",
                    severity="high"
                )

        return ValidationResult(valid=True)


# 정책 예시
class BudgetPolicy:
    """예산 정책"""

    def __init__(self, daily_limit: float):
        self.daily_limit = daily_limit

    async def evaluate(self,
                       action: Action,
                       context: Dict) -> PolicyDecision:
        current_usage = await self.get_daily_usage(context["agent_id"])

        if current_usage >= self.daily_limit:
            return PolicyDecision(
                deny=True,
                reason=f"Daily budget limit ({self.daily_limit}) exceeded"
            )

        return PolicyDecision(allow=True)
```

### 7.2 감사 로깅

```python
class AuditLogger:
    """
    감사 로그 시스템
    """

    def __init__(self, storage: AuditStorage):
        self.storage = storage

    async def log_event(self, event: AuditEvent):
        """감사 이벤트 기록"""
        event_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event.type,
            "agent_id": event.agent_id,
            "user_id": event.user_id,
            "action": event.action,
            "input": self._sanitize(event.input),
            "output": self._sanitize(event.output),
            "metadata": {
                "session_id": event.session_id,
                "ip_address": event.ip_address,
                "model_used": event.model,
                "tokens": event.tokens,
                "latency_ms": event.latency_ms,
                "cost": event.cost,
            },
            "compliance": {
                "data_classification": event.data_classification,
                "consent_verified": event.consent_verified,
                "retention_policy": event.retention_policy,
            }
        }

        await self.storage.store(event_record)

        # 고위험 이벤트 알림
        if event.risk_level == "high":
            await self.alert_security_team(event_record)

    def _sanitize(self, data: str) -> str:
        """민감 정보 마스킹"""
        # 신용카드 번호 마스킹
        data = re.sub(
            r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
            '[CARD_MASKED]',
            data
        )
        # 기타 민감 정보 마스킹
        return data
```

---

## 8. 실전 AgentOps 구현

### 8.1 통합 AgentOps 설정

```python
# agentops_config.py
from agentops import AgentOps, configure

# AgentOps 초기화
agentops = AgentOps(
    project_name="travel-booking-system",
    environment="production",

    # 추적 설정
    tracing=TracingConfig(
        enabled=True,
        exporter="otlp",
        endpoint="http://otel-collector:4317",
        sampling_rate=1.0,  # 100% 샘플링
    ),

    # 메트릭 설정
    metrics=MetricsConfig(
        enabled=True,
        exporter="prometheus",
        port=9090,
        include_costs=True,
    ),

    # 로깅 설정
    logging=LoggingConfig(
        level="INFO",
        format="json",
        include_traces=True,
    ),

    # 평가 설정
    evaluation=EvaluationConfig(
        enabled=True,
        evaluators=["task_completion", "response_quality", "efficiency"],
        auto_evaluate=True,
        sample_rate=0.1,  # 10% 요청 자동 평가
    ),

    # 가드레일 설정
    guardrails=GuardrailsConfig(
        enabled=True,
        input_validation=True,
        output_validation=True,
        pii_detection=True,
        content_filtering=True,
    ),

    # 비용 관리
    cost_management=CostConfig(
        budget_alerts=True,
        daily_limit=100.0,  # $100/일
        model_routing=True,
    ),
)


# 에이전트에 적용
@agentops.trace
class ProductionAgent:
    """프로덕션 환경 에이전트"""

    def __init__(self):
        self.metrics = agentops.get_metrics()
        self.guardrails = agentops.get_guardrails()

    @agentops.trace_action("process_request")
    async def process(self, request: Dict) -> Dict:
        # 입력 검증
        validation = await self.guardrails.validate_input(request)
        if not validation.valid:
            raise InvalidInputError(validation.reason)

        # 처리
        with self.metrics.timer("processing_time"):
            result = await self._do_process(request)

        # 출력 검증
        output_validation = await self.guardrails.validate_output(result)
        if not output_validation.valid:
            result = await self._sanitize_output(result)

        return result
```

---

## 9. 다음 단계

- [**아키텍처 패턴**](/docs/architecture/patterns): 에이전트 시스템 설계 패턴
- [**실전 예제**](/docs/practical/case-studies): 산업별 AgentOps 적용 사례
- [**참고 문헌**](/docs/references/papers): 관련 논문 및 자료
