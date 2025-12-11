---
sidebar_position: 3
title: "스케일링 전략"
description: "AI 에이전트 시스템의 오토스케일링 및 용량 계획"
---

# 스케일링 전략 가이드

AI 에이전트 시스템의 부하에 따른 자동 확장과 용량 계획 전략을 설명합니다.

---

## 1. 스케일링 고려사항

### 1.1 에이전트 워크로드 특성

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Agent Workload Characteristics                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  특성                    영향                    스케일링 전략           │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  높은 지연시간           긴 요청 처리 시간        더 많은 인스턴스       │
│  (LLM API 호출)         (초 ~ 분 단위)           병렬 처리 증가         │
│                                                                          │
│  가변적 비용             토큰 기반 과금           비용 기반 제한          │
│  (토큰 사용량)          예측 어려움              예산 기반 스케일링      │
│                                                                          │
│  버스트 트래픽           갑작스러운 부하 증가     빠른 스케일업          │
│  (사용자 패턴)          예측 어려움              프리워밍               │
│                                                                          │
│  상태 유지 필요          세션 친화성 필요         Sticky Session         │
│  (대화 컨텍스트)        복잡한 로드밸런싱        상태 외부화            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. HPA 상세 설정

### 2.1 멀티 메트릭 HPA

```yaml
# hpa-advanced.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-runtime-hpa
  namespace: agentops
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-runtime
  minReplicas: 3
  maxReplicas: 100

  metrics:
    # 1. CPU 사용률 (기본)
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # 2. 메모리 사용률
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # 3. 요청 큐 깊이 (커스텀 메트릭)
    - type: Pods
      pods:
        metric:
          name: agent_request_queue_depth
        target:
          type: AverageValue
          averageValue: "20"

    # 4. 활성 요청 수 (커스텀 메트릭)
    - type: Pods
      pods:
        metric:
          name: agent_requests_in_progress
        target:
          type: AverageValue
          averageValue: "5"

    # 5. 요청 지연시간 P95 (외부 메트릭)
    - type: External
      external:
        metric:
          name: agent_request_latency_p95
          selector:
            matchLabels:
              agent: agent-runtime
        target:
          type: Value
          value: "5"  # 5초

  # 스케일링 동작 정의
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30  # 30초 안정화
      policies:
        # 빠른 스케일업: 15초마다 100% 증가 또는 5개 추가
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 5
          periodSeconds: 15
      selectPolicy: Max  # 더 공격적인 정책 선택

    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 안정화
      policies:
        # 느린 스케일다운: 60초마다 10% 감소
        - type: Percent
          value: 10
          periodSeconds: 60
        - type: Pods
          value: 2
          periodSeconds: 60
      selectPolicy: Min  # 더 보수적인 정책 선택
```

### 2.2 커스텀 메트릭 어댑터

```yaml
# prometheus-adapter-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-adapter-config
  namespace: monitoring
data:
  config.yaml: |
    rules:
      # 요청 큐 깊이
      - seriesQuery: 'agent_request_queue_depth{namespace!="",pod!=""}'
        resources:
          overrides:
            namespace: {resource: "namespace"}
            pod: {resource: "pod"}
        name:
          matches: "^(.*)$"
          as: "${1}"
        metricsQuery: 'avg(<<.Series>>{<<.LabelMatchers>>}) by (<<.GroupBy>>)'

      # 활성 요청 수
      - seriesQuery: 'agent_requests_in_progress{namespace!="",pod!=""}'
        resources:
          overrides:
            namespace: {resource: "namespace"}
            pod: {resource: "pod"}
        name:
          matches: "^(.*)$"
          as: "${1}"
        metricsQuery: 'avg(<<.Series>>{<<.LabelMatchers>>}) by (<<.GroupBy>>)'

      # P95 지연시간
      - seriesQuery: 'agent_request_duration_seconds_bucket{namespace!=""}'
        resources:
          overrides:
            namespace: {resource: "namespace"}
        name:
          as: "agent_request_latency_p95"
        metricsQuery: 'histogram_quantile(0.95, sum(rate(<<.Series>>{<<.LabelMatchers>>}[5m])) by (le, <<.GroupBy>>))'
```

---

## 3. KEDA 기반 이벤트 드리븐 스케일링

### 3.1 KEDA ScaledObject

```yaml
# keda-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: agent-runtime-keda
  namespace: agentops
spec:
  scaleTargetRef:
    name: agent-runtime
  pollingInterval: 15
  cooldownPeriod: 300
  minReplicaCount: 3
  maxReplicaCount: 100

  triggers:
    # 1. Prometheus 메트릭 기반
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: agent_requests_per_second
        query: |
          sum(rate(agent_requests_total{deployment="agent-runtime"}[1m]))
        threshold: "50"  # 초당 50 요청당 1개 파드

    # 2. Redis 큐 길이 기반
    - type: redis
      metadata:
        address: redis:6379
        listName: agent_request_queue
        listLength: "100"  # 100개 메시지당 1개 파드

    # 3. NATS 메시지 기반
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: "nats:8222"
        account: "$G"
        stream: "AGENT_TASKS"
        consumer: "agent-consumer"
        lagThreshold: "50"

    # 4. 스케줄 기반 (예측 가능한 트래픽)
    - type: cron
      metadata:
        timezone: Asia/Seoul
        start: 0 9 * * 1-5   # 평일 오전 9시
        end: 0 18 * * 1-5    # 평일 오후 6시
        desiredReplicas: "20"

  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 30
          policies:
            - type: Percent
              value: 100
              periodSeconds: 15
        scaleDown:
          stabilizationWindowSeconds: 300
```

---

## 4. 비용 기반 스케일링

### 4.1 비용 제한 컨트롤러

```python
# cost_controller.py

class CostBasedScaleController:
    """
    비용 기반 스케일 컨트롤러
    토큰 예산에 따라 스케일링 제한
    """

    def __init__(
        self,
        k8s_client,
        prometheus_client,
        hourly_budget: float = 100.0,
        daily_budget: float = 2000.0
    ):
        self.k8s = k8s_client
        self.prometheus = prometheus_client
        self.hourly_budget = hourly_budget
        self.daily_budget = daily_budget

    async def check_and_adjust(self):
        """주기적으로 비용 확인 및 스케일 조정"""

        # 현재 시간당 비용 조회
        hourly_cost = await self._get_hourly_cost()
        daily_cost = await self._get_daily_cost()

        deployment = await self.k8s.get_deployment(
            "agent-runtime", "agentops"
        )
        current_replicas = deployment.spec.replicas

        # 예산 초과 시 스케일다운
        if hourly_cost > self.hourly_budget * 0.9:
            new_replicas = max(3, int(current_replicas * 0.7))
            await self._scale_deployment(new_replicas)
            await self._send_alert(
                f"Hourly budget 90% reached: ${hourly_cost:.2f}"
            )

        if daily_cost > self.daily_budget * 0.8:
            new_replicas = max(3, int(current_replicas * 0.5))
            await self._scale_deployment(new_replicas)
            await self._send_alert(
                f"Daily budget 80% reached: ${daily_cost:.2f}"
            )

        # HPA max replicas 동적 조정
        remaining_budget = self.hourly_budget - hourly_cost
        cost_per_replica_hour = await self._estimate_cost_per_replica()

        max_affordable_replicas = int(
            remaining_budget / cost_per_replica_hour
        ) + current_replicas

        await self._update_hpa_max(
            min(100, max(10, max_affordable_replicas))
        )

    async def _get_hourly_cost(self) -> float:
        query = 'increase(agent_cost_usd_total[1h])'
        result = await self.prometheus.query(query)
        return float(result[0]['value'][1])

    async def _estimate_cost_per_replica(self) -> float:
        query = '''
            sum(increase(agent_cost_usd_total[1h]))
            /
            avg(agent_runtime_replicas[1h])
        '''
        result = await self.prometheus.query(query)
        return float(result[0]['value'][1])
```

---

## 5. 용량 계획

### 5.1 용량 계산

```python
# capacity_planner.py

@dataclass
class CapacityRequirements:
    """용량 요구사항"""
    target_rps: float              # 목표 초당 요청 수
    target_latency_p95_ms: float   # 목표 P95 지연시간
    avg_request_duration_ms: float # 평균 요청 처리 시간
    peak_multiplier: float = 2.0   # 피크 시간 배수
    safety_margin: float = 0.3     # 안전 마진 (30%)

def calculate_replicas(req: CapacityRequirements) -> int:
    """필요한 레플리카 수 계산"""

    # Little's Law: L = λ * W
    # L: 시스템 내 평균 요청 수
    # λ: 요청 도착률 (RPS)
    # W: 평균 체류 시간

    avg_concurrent = req.target_rps * (req.avg_request_duration_ms / 1000)

    # 피크 시간 고려
    peak_concurrent = avg_concurrent * req.peak_multiplier

    # 파드당 동시 처리 가능 요청 수 (보수적으로 5개)
    requests_per_pod = 5

    # 기본 레플리카 수
    base_replicas = math.ceil(peak_concurrent / requests_per_pod)

    # 안전 마진 적용
    replicas_with_margin = math.ceil(base_replicas * (1 + req.safety_margin))

    # 최소 3개 보장
    return max(3, replicas_with_margin)

# 사용 예시
requirements = CapacityRequirements(
    target_rps=100,
    target_latency_p95_ms=5000,
    avg_request_duration_ms=3000,
    peak_multiplier=2.0,
    safety_margin=0.3
)

min_replicas = calculate_replicas(requirements)
print(f"Recommended min replicas: {min_replicas}")
# Output: Recommended min replicas: 156
```

### 5.2 비용 예측

```python
def estimate_monthly_cost(
    avg_requests_per_day: int,
    avg_tokens_per_request: int,
    model: str = "gpt-4o"
) -> dict:
    """월간 비용 예측"""

    pricing = {
        "gpt-4o": {"input": 0.005, "output": 0.015},
        "gpt-4": {"input": 0.03, "output": 0.06},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    }

    rates = pricing.get(model, pricing["gpt-4o"])

    # 가정: input:output = 1:1
    tokens_per_request = avg_tokens_per_request
    input_tokens = tokens_per_request * 0.5
    output_tokens = tokens_per_request * 0.5

    cost_per_request = (
        (input_tokens / 1000) * rates["input"] +
        (output_tokens / 1000) * rates["output"]
    )

    daily_cost = cost_per_request * avg_requests_per_day
    monthly_cost = daily_cost * 30

    return {
        "cost_per_request": cost_per_request,
        "daily_cost": daily_cost,
        "monthly_cost": monthly_cost,
        "yearly_cost": monthly_cost * 12
    }

# 사용 예시
costs = estimate_monthly_cost(
    avg_requests_per_day=10000,
    avg_tokens_per_request=2000,
    model="gpt-4o"
)
print(f"Estimated monthly cost: ${costs['monthly_cost']:.2f}")
```

---

## 6. 다음 단계

- [Guardrails 시스템](../security/guardrails) - 스케일링 시 보안 고려
- [비용 최적화](../best-practices/cost-optimization) - 비용 효율적 운영
- [프로덕션 체크리스트](../best-practices/production-checklist) - 스케일링 검증
