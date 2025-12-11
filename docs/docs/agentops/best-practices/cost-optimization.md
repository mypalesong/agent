---
sidebar_position: 1
title: "비용 최적화"
description: "AI 에이전트 운영 비용을 최적화하는 전략"
---

# 비용 최적화 가이드

AI 에이전트 시스템의 운영 비용을 효과적으로 관리하고 최적화하는 전략을 설명합니다.

---

## 1. 비용 구조 이해

### 1.1 AI 에이전트 비용 분류

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Agent Cost Breakdown                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│  │   LLM API       │    │  Infrastructure │    │   Operations    │    │
│  │   (60-80%)      │    │   (15-25%)      │    │   (5-15%)       │    │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    │
│           │                      │                      │              │
│           ▼                      ▼                      ▼              │
│  • Input Tokens         • Compute (K8s)        • Monitoring           │
│  • Output Tokens        • Storage              • Logging              │
│  • Embedding Calls      • Network              • Team Cost            │
│  • Fine-tuning          • Database             • On-call              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 비용 메트릭

```python
# agentops/cost/metrics.py

from dataclasses import dataclass
from typing import Dict, Optional
from datetime import datetime
from enum import Enum

class CostCategory(Enum):
    LLM_API = "llm_api"
    COMPUTE = "compute"
    STORAGE = "storage"
    NETWORK = "network"
    OPERATIONS = "operations"

@dataclass
class CostMetrics:
    """비용 메트릭"""

    # LLM 비용
    input_tokens: int = 0
    output_tokens: int = 0
    total_llm_cost_usd: float = 0.0

    # 인프라 비용
    compute_cost_usd: float = 0.0
    storage_cost_usd: float = 0.0
    network_cost_usd: float = 0.0

    # 효율성 메트릭
    cost_per_request: float = 0.0
    cost_per_successful_task: float = 0.0
    tokens_per_task: float = 0.0

    def total_cost(self) -> float:
        return (
            self.total_llm_cost_usd +
            self.compute_cost_usd +
            self.storage_cost_usd +
            self.network_cost_usd
        )

# Prometheus 메트릭 정의
COST_METRICS = """
# LLM 비용 메트릭
agent_llm_cost_usd_total{model, provider, agent_id}
agent_tokens_total{type="input|output", model, agent_id}
agent_llm_calls_total{model, agent_id}

# 인프라 비용 메트릭
agent_compute_cost_usd{instance_type, region}
agent_storage_cost_usd{storage_class, purpose}
agent_network_cost_usd{direction, destination}

# 효율성 메트릭
agent_cost_per_request_usd{agent_id}
agent_cost_per_task_usd{agent_id, task_type}
agent_tokens_per_task{agent_id, task_type}
"""
```

---

## 2. LLM 비용 최적화

### 2.1 모델 선택 전략

```python
# agentops/cost/model_router.py

from dataclasses import dataclass
from typing import Dict, List, Optional
import re

@dataclass
class ModelProfile:
    """모델 프로파일"""
    name: str
    provider: str
    input_cost_per_1k: float   # USD per 1K tokens
    output_cost_per_1k: float  # USD per 1K tokens
    context_window: int
    quality_score: float       # 0-1
    latency_ms: int           # 평균 응답 시간
    capabilities: List[str]

# 모델 프로파일 정의
MODEL_PROFILES = {
    "gpt-4o": ModelProfile(
        name="gpt-4o",
        provider="openai",
        input_cost_per_1k=0.005,
        output_cost_per_1k=0.015,
        context_window=128000,
        quality_score=0.95,
        latency_ms=800,
        capabilities=["reasoning", "coding", "analysis", "creative"]
    ),
    "gpt-4o-mini": ModelProfile(
        name="gpt-4o-mini",
        provider="openai",
        input_cost_per_1k=0.00015,
        output_cost_per_1k=0.0006,
        context_window=128000,
        quality_score=0.85,
        latency_ms=400,
        capabilities=["reasoning", "coding", "analysis"]
    ),
    "claude-3-5-sonnet": ModelProfile(
        name="claude-3-5-sonnet-20241022",
        provider="anthropic",
        input_cost_per_1k=0.003,
        output_cost_per_1k=0.015,
        context_window=200000,
        quality_score=0.95,
        latency_ms=700,
        capabilities=["reasoning", "coding", "analysis", "creative"]
    ),
    "claude-3-5-haiku": ModelProfile(
        name="claude-3-5-haiku-20241022",
        provider="anthropic",
        input_cost_per_1k=0.001,
        output_cost_per_1k=0.005,
        context_window=200000,
        quality_score=0.80,
        latency_ms=300,
        capabilities=["reasoning", "analysis"]
    ),
}

class SmartModelRouter:
    """
    지능형 모델 라우터
    요청 특성에 따라 최적 모델 선택
    """

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.profiles = MODEL_PROFILES

    def select_model(
        self,
        task_type: str,
        complexity: str,  # simple, medium, complex
        required_capabilities: List[str] = None,
        max_cost_per_request: float = None,
        max_latency_ms: int = None
    ) -> str:
        """최적 모델 선택"""

        candidates = list(self.profiles.values())

        # 필수 기능 필터링
        if required_capabilities:
            candidates = [
                m for m in candidates
                if all(cap in m.capabilities for cap in required_capabilities)
            ]

        # 비용 제한 필터링
        if max_cost_per_request:
            # 예상 토큰 수 기반 필터링
            estimated_tokens = self._estimate_tokens(task_type, complexity)
            candidates = [
                m for m in candidates
                if self._estimate_cost(m, estimated_tokens) <= max_cost_per_request
            ]

        # 지연시간 제한 필터링
        if max_latency_ms:
            candidates = [
                m for m in candidates
                if m.latency_ms <= max_latency_ms
            ]

        if not candidates:
            # 폴백: 가장 저렴한 모델
            return "gpt-4o-mini"

        # 복잡도별 선택 전략
        if complexity == "simple":
            # 가장 저렴한 모델
            return min(candidates, key=lambda m: m.input_cost_per_1k).name
        elif complexity == "complex":
            # 가장 품질 좋은 모델
            return max(candidates, key=lambda m: m.quality_score).name
        else:
            # 비용 대비 품질 최적
            return max(
                candidates,
                key=lambda m: m.quality_score / (m.input_cost_per_1k + m.output_cost_per_1k)
            ).name

    def _estimate_tokens(self, task_type: str, complexity: str) -> Dict[str, int]:
        """토큰 수 예상"""
        estimates = {
            ("simple", "qa"): {"input": 500, "output": 200},
            ("medium", "qa"): {"input": 1500, "output": 500},
            ("complex", "qa"): {"input": 4000, "output": 1500},
            ("simple", "coding"): {"input": 800, "output": 400},
            ("medium", "coding"): {"input": 2000, "output": 1000},
            ("complex", "coding"): {"input": 5000, "output": 3000},
        }
        return estimates.get((complexity, task_type), {"input": 1000, "output": 500})

    def _estimate_cost(self, model: ModelProfile, tokens: Dict[str, int]) -> float:
        """비용 예상"""
        return (
            (tokens["input"] / 1000) * model.input_cost_per_1k +
            (tokens["output"] / 1000) * model.output_cost_per_1k
        )
```

### 2.2 프롬프트 최적화

```python
# agentops/cost/prompt_optimizer.py

class PromptOptimizer:
    """프롬프트 최적화"""

    def __init__(self):
        self.compression_ratio_target = 0.7  # 30% 압축 목표

    def optimize(self, prompt: str) -> str:
        """프롬프트 최적화"""

        optimized = prompt

        # 1. 불필요한 공백 제거
        optimized = self._remove_excess_whitespace(optimized)

        # 2. 중복 지시문 제거
        optimized = self._remove_duplicates(optimized)

        # 3. 간결한 표현으로 변환
        optimized = self._use_concise_language(optimized)

        return optimized

    def _remove_excess_whitespace(self, text: str) -> str:
        """불필요한 공백 제거"""
        import re
        # 연속된 공백을 하나로
        text = re.sub(r' +', ' ', text)
        # 연속된 줄바꿈을 두 개로
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def _remove_duplicates(self, text: str) -> str:
        """중복 문장 제거"""
        sentences = text.split('.')
        seen = set()
        unique = []
        for s in sentences:
            normalized = s.strip().lower()
            if normalized and normalized not in seen:
                seen.add(normalized)
                unique.append(s)
        return '.'.join(unique)

    def _use_concise_language(self, text: str) -> str:
        """간결한 표현 사용"""
        replacements = {
            "in order to": "to",
            "due to the fact that": "because",
            "at this point in time": "now",
            "in the event that": "if",
            "prior to": "before",
            "subsequent to": "after",
            "with regard to": "about",
            "for the purpose of": "to",
        }
        for verbose, concise in replacements.items():
            text = text.replace(verbose, concise)
        return text

class ContextWindowManager:
    """컨텍스트 윈도우 관리"""

    def __init__(self, max_tokens: int = 8000):
        self.max_tokens = max_tokens

    def manage_context(
        self,
        messages: List[Dict],
        priority_order: List[str] = None
    ) -> List[Dict]:
        """컨텍스트 관리"""

        priority_order = priority_order or [
            "system",    # 시스템 프롬프트 (항상 유지)
            "recent",    # 최근 메시지
            "relevant",  # 관련성 높은 메시지
            "old"        # 오래된 메시지
        ]

        # 토큰 수 계산
        total_tokens = sum(self._count_tokens(m["content"]) for m in messages)

        if total_tokens <= self.max_tokens:
            return messages

        # 메시지 분류
        categorized = self._categorize_messages(messages)

        # 우선순위에 따라 메시지 선택
        selected = []
        remaining_tokens = self.max_tokens

        for category in priority_order:
            for msg in categorized.get(category, []):
                msg_tokens = self._count_tokens(msg["content"])
                if msg_tokens <= remaining_tokens:
                    selected.append(msg)
                    remaining_tokens -= msg_tokens

        return selected

    def _count_tokens(self, text: str) -> int:
        """토큰 수 계산 (근사)"""
        return len(text) // 4

    def _categorize_messages(self, messages: List[Dict]) -> Dict[str, List[Dict]]:
        """메시지 분류"""
        categorized = {
            "system": [],
            "recent": [],
            "relevant": [],
            "old": []
        }

        for i, msg in enumerate(messages):
            if msg.get("role") == "system":
                categorized["system"].append(msg)
            elif i >= len(messages) - 5:  # 최근 5개
                categorized["recent"].append(msg)
            else:
                categorized["old"].append(msg)

        return categorized
```

### 2.3 캐싱 전략

```python
# agentops/cost/caching.py

import hashlib
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import redis

class SemanticCache:
    """
    시멘틱 캐싱
    유사한 쿼리에 대해 캐시된 응답 반환
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        embedding_model,
        similarity_threshold: float = 0.95,
        ttl_hours: int = 24
    ):
        self.redis = redis_client
        self.embedder = embedding_model
        self.threshold = similarity_threshold
        self.ttl = timedelta(hours=ttl_hours)

    async def get(self, query: str) -> Optional[str]:
        """캐시 조회"""

        # 1. 정확히 일치하는 쿼리 확인
        exact_key = self._hash_query(query)
        exact_result = await self.redis.get(f"cache:exact:{exact_key}")
        if exact_result:
            return exact_result.decode()

        # 2. 시멘틱 유사도 검색
        query_embedding = await self.embedder.embed(query)

        # 벡터 유사도 검색 (Redis Vector Search 또는 별도 벡터 DB)
        similar = await self._find_similar(query_embedding)

        if similar and similar["score"] >= self.threshold:
            return similar["response"]

        return None

    async def set(
        self,
        query: str,
        response: str,
        metadata: Dict = None
    ):
        """캐시 저장"""

        exact_key = self._hash_query(query)
        query_embedding = await self.embedder.embed(query)

        cache_entry = {
            "query": query,
            "response": response,
            "embedding": query_embedding,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }

        # 정확히 일치 캐시
        await self.redis.setex(
            f"cache:exact:{exact_key}",
            self.ttl,
            response
        )

        # 시멘틱 캐시 (벡터 저장)
        await self._store_embedding(exact_key, cache_entry)

    def _hash_query(self, query: str) -> str:
        """쿼리 해시"""
        normalized = query.lower().strip()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    async def _find_similar(self, embedding: List[float]) -> Optional[Dict]:
        """유사 벡터 검색"""
        # Redis Vector Search 또는 Pinecone/Qdrant 사용
        pass

    async def _store_embedding(self, key: str, entry: Dict):
        """임베딩 저장"""
        pass

class ResponseCache:
    """
    결정적 응답 캐싱
    동일한 입력에 대해 동일한 출력이 보장되는 경우
    """

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def get_or_compute(
        self,
        cache_key: str,
        compute_fn,
        ttl: int = 3600
    ):
        """캐시 조회 또는 계산"""

        cached = await self.redis.get(f"response:{cache_key}")
        if cached:
            return json.loads(cached)

        # 계산
        result = await compute_fn()

        # 캐시 저장
        await self.redis.setex(
            f"response:{cache_key}",
            ttl,
            json.dumps(result)
        )

        return result
```

---

## 3. 인프라 비용 최적화

### 3.1 리소스 최적화

```yaml
# k8s/cost-optimized-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-runtime
  namespace: agentops
spec:
  replicas: 3
  template:
    spec:
      # 스팟/프리엠티블 노드 사용
      nodeSelector:
        node-type: spot

      tolerations:
        - key: "spot"
          operator: "Equal"
          value: "true"
          effect: "NoSchedule"

      containers:
        - name: agent-runtime
          image: agent-runtime:latest

          # 리소스 요청 최적화
          resources:
            requests:
              cpu: "500m"      # 실제 사용량 기반
              memory: "512Mi"
            limits:
              cpu: "2000m"     # 버스트 허용
              memory: "2Gi"

          # 버티컬 스케일링을 위한 VPA 지원
          # VPA가 자동으로 리소스 조정

---
# Vertical Pod Autoscaler
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: agent-runtime-vpa
  namespace: agentops
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-runtime
  updatePolicy:
    updateMode: "Auto"  # 자동 리소스 조정
  resourcePolicy:
    containerPolicies:
      - containerName: agent-runtime
        minAllowed:
          cpu: "200m"
          memory: "256Mi"
        maxAllowed:
          cpu: "4000m"
          memory: "4Gi"
        controlledResources: ["cpu", "memory"]
```

### 3.2 스팟 인스턴스 활용

```python
# agentops/cost/spot_manager.py

class SpotInstanceManager:
    """스팟 인스턴스 관리"""

    def __init__(self, k8s_client, config: Dict):
        self.k8s = k8s_client
        self.config = config
        self.fallback_enabled = True

    async def configure_node_pool(self):
        """노드 풀 구성"""

        node_pools = [
            {
                "name": "spot-pool",
                "instance_types": [
                    "m5.large", "m5a.large", "m5d.large",  # 다양한 타입
                    "m5.xlarge", "m5a.xlarge"
                ],
                "spot_percentage": 80,  # 80% 스팟
                "on_demand_base": 2,    # 최소 2개 온디맨드
                "max_nodes": 50,
                "labels": {
                    "node-type": "spot",
                    "workload": "agent"
                },
                "taints": [
                    {
                        "key": "spot",
                        "value": "true",
                        "effect": "NoSchedule"
                    }
                ]
            },
            {
                "name": "on-demand-pool",
                "instance_types": ["m5.large"],
                "spot_percentage": 0,
                "max_nodes": 10,
                "labels": {
                    "node-type": "on-demand",
                    "workload": "critical"
                }
            }
        ]

        return node_pools

    async def handle_spot_interruption(self, node_name: str):
        """스팟 인터럽션 처리"""

        # 1. 노드의 파드 목록 조회
        pods = await self.k8s.list_pods_on_node(node_name)

        # 2. 우아한 종료 시작
        for pod in pods:
            if pod.metadata.labels.get("graceful-shutdown") == "enabled":
                await self._initiate_graceful_shutdown(pod)

        # 3. 노드 드레인
        await self.k8s.drain_node(node_name, timeout=90)

    async def _initiate_graceful_shutdown(self, pod):
        """우아한 종료 시작"""
        # 진행 중인 요청 완료 대기
        # 새 요청 수락 중지
        pass
```

### 3.3 비용 모니터링 대시보드

```yaml
# grafana-cost-dashboard.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-cost-dashboard
  namespace: monitoring
data:
  cost-dashboard.json: |
    {
      "title": "AgentOps Cost Dashboard",
      "panels": [
        {
          "title": "Total Daily Cost",
          "type": "stat",
          "targets": [
            {
              "expr": "sum(increase(agent_llm_cost_usd_total[24h])) + sum(increase(agent_compute_cost_usd[24h]))"
            }
          ],
          "fieldConfig": {
            "defaults": {
              "unit": "currencyUSD"
            }
          }
        },
        {
          "title": "Cost by Model",
          "type": "piechart",
          "targets": [
            {
              "expr": "sum(increase(agent_llm_cost_usd_total[24h])) by (model)"
            }
          ]
        },
        {
          "title": "Cost per Request Trend",
          "type": "timeseries",
          "targets": [
            {
              "expr": "sum(rate(agent_llm_cost_usd_total[1h])) / sum(rate(agent_requests_total[1h]))",
              "legendFormat": "Cost per Request"
            }
          ]
        },
        {
          "title": "Token Usage",
          "type": "timeseries",
          "targets": [
            {
              "expr": "sum(rate(agent_tokens_total{type=\"input\"}[5m])) * 60",
              "legendFormat": "Input Tokens/min"
            },
            {
              "expr": "sum(rate(agent_tokens_total{type=\"output\"}[5m])) * 60",
              "legendFormat": "Output Tokens/min"
            }
          ]
        },
        {
          "title": "Cache Hit Rate",
          "type": "gauge",
          "targets": [
            {
              "expr": "sum(rate(agent_cache_hits_total[1h])) / sum(rate(agent_cache_requests_total[1h])) * 100"
            }
          ],
          "fieldConfig": {
            "defaults": {
              "unit": "percent",
              "thresholds": {
                "steps": [
                  {"value": 0, "color": "red"},
                  {"value": 50, "color": "yellow"},
                  {"value": 80, "color": "green"}
                ]
              }
            }
          }
        },
        {
          "title": "Cost Savings from Caching",
          "type": "stat",
          "targets": [
            {
              "expr": "sum(increase(agent_cache_cost_saved_usd[24h]))"
            }
          ]
        }
      ]
    }
```

---

## 4. 비용 예산 관리

### 4.1 예산 컨트롤러

```python
# agentops/cost/budget_controller.py

from dataclasses import dataclass
from typing import Dict, Optional
from datetime import datetime, timedelta
from enum import Enum

class BudgetPeriod(Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

@dataclass
class Budget:
    """예산 정의"""
    name: str
    amount_usd: float
    period: BudgetPeriod
    alert_thresholds: List[float]  # e.g., [0.5, 0.8, 0.95]
    hard_limit: bool = False       # True면 초과 시 요청 거부

class BudgetController:
    """예산 컨트롤러"""

    def __init__(
        self,
        budgets: Dict[str, Budget],
        metrics_client,
        alert_client
    ):
        self.budgets = budgets
        self.metrics = metrics_client
        self.alerts = alert_client

    async def check_budget(
        self,
        budget_name: str,
        additional_cost: float = 0
    ) -> Dict:
        """예산 확인"""

        budget = self.budgets.get(budget_name)
        if not budget:
            return {"allowed": True}

        # 현재 사용량 조회
        current_spend = await self._get_current_spend(budget)
        projected_spend = current_spend + additional_cost

        # 사용률 계산
        utilization = projected_spend / budget.amount_usd

        # 알림 체크
        for threshold in budget.alert_thresholds:
            if utilization >= threshold:
                await self._send_alert(budget, utilization, threshold)

        # 하드 리밋 체크
        if budget.hard_limit and projected_spend > budget.amount_usd:
            return {
                "allowed": False,
                "reason": f"Budget exceeded: ${projected_spend:.2f} > ${budget.amount_usd:.2f}",
                "utilization": utilization
            }

        return {
            "allowed": True,
            "current_spend": current_spend,
            "remaining": budget.amount_usd - current_spend,
            "utilization": utilization
        }

    async def _get_current_spend(self, budget: Budget) -> float:
        """현재 기간 지출 조회"""

        period_start = self._get_period_start(budget.period)

        query = f"""
            sum(increase(agent_llm_cost_usd_total[{self._period_to_duration(budget.period)}]))
        """

        result = await self.metrics.query(query)
        return float(result[0]["value"][1]) if result else 0.0

    def _get_period_start(self, period: BudgetPeriod) -> datetime:
        """기간 시작 시점"""
        now = datetime.utcnow()

        if period == BudgetPeriod.HOURLY:
            return now.replace(minute=0, second=0, microsecond=0)
        elif period == BudgetPeriod.DAILY:
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == BudgetPeriod.WEEKLY:
            return (now - timedelta(days=now.weekday())).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        else:  # MONTHLY
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def _period_to_duration(self, period: BudgetPeriod) -> str:
        """Prometheus duration 변환"""
        return {
            BudgetPeriod.HOURLY: "1h",
            BudgetPeriod.DAILY: "24h",
            BudgetPeriod.WEEKLY: "7d",
            BudgetPeriod.MONTHLY: "30d"
        }[period]

    async def _send_alert(
        self,
        budget: Budget,
        utilization: float,
        threshold: float
    ):
        """예산 알림 전송"""
        await self.alerts.send(
            severity="warning" if utilization < 0.95 else "critical",
            title=f"Budget Alert: {budget.name}",
            message=f"Budget utilization at {utilization*100:.1f}% (threshold: {threshold*100:.0f}%)",
            labels={
                "budget": budget.name,
                "utilization": str(utilization),
                "threshold": str(threshold)
            }
        )
```

### 4.2 비용 할당

```python
# agentops/cost/allocation.py

class CostAllocator:
    """비용 할당"""

    def __init__(self, metrics_client):
        self.metrics = metrics_client

    async def allocate_costs(
        self,
        start_date: datetime,
        end_date: datetime,
        allocation_keys: List[str]  # e.g., ["team", "project", "agent"]
    ) -> Dict:
        """비용 할당 계산"""

        allocations = {}

        for key in allocation_keys:
            query = f"""
                sum(increase(agent_llm_cost_usd_total[{self._calculate_duration(start_date, end_date)}]))
                by ({key})
            """

            results = await self.metrics.query(query)

            allocations[key] = {
                item["metric"][key]: float(item["value"][1])
                for item in results
            }

        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "allocations": allocations,
            "total": sum(allocations.get(allocation_keys[0], {}).values())
        }

    async def generate_chargeback_report(
        self,
        month: int,
        year: int
    ) -> Dict:
        """차지백 리포트 생성"""

        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        allocations = await self.allocate_costs(
            start_date,
            end_date,
            ["team", "project"]
        )

        return {
            "report_type": "chargeback",
            "period": f"{year}-{month:02d}",
            "by_team": allocations["allocations"].get("team", {}),
            "by_project": allocations["allocations"].get("project", {}),
            "total_cost": allocations["total"]
        }
```

---

## 5. 비용 최적화 체크리스트

```yaml
# cost-optimization-checklist.yaml

optimization_areas:
  llm_costs:
    - name: "모델 선택 최적화"
      description: "작업 복잡도에 맞는 모델 사용"
      potential_savings: "30-50%"
      implementation:
        - "SmartModelRouter 도입"
        - "작업별 모델 매핑 정의"
        - "A/B 테스트로 품질 검증"

    - name: "프롬프트 최적화"
      description: "불필요한 토큰 제거"
      potential_savings: "10-20%"
      implementation:
        - "PromptOptimizer 적용"
        - "시스템 프롬프트 압축"
        - "컨텍스트 윈도우 관리"

    - name: "캐싱 전략"
      description: "반복 쿼리 캐싱"
      potential_savings: "20-40%"
      implementation:
        - "SemanticCache 구현"
        - "캐시 히트율 모니터링"
        - "TTL 최적화"

    - name: "배치 처리"
      description: "요청 배치로 오버헤드 감소"
      potential_savings: "5-15%"
      implementation:
        - "요청 그룹핑"
        - "비동기 배치 처리"

  infrastructure_costs:
    - name: "스팟 인스턴스 활용"
      description: "비크리티컬 워크로드에 스팟 사용"
      potential_savings: "60-70%"
      implementation:
        - "스팟 노드 풀 구성"
        - "인터럽션 핸들링"
        - "폴백 전략"

    - name: "리소스 라이트사이징"
      description: "실제 사용량에 맞는 리소스 할당"
      potential_savings: "20-30%"
      implementation:
        - "VPA 활성화"
        - "리소스 사용량 분석"
        - "요청/제한 최적화"

    - name: "오토스케일링 최적화"
      description: "효율적인 스케일링 정책"
      potential_savings: "15-25%"
      implementation:
        - "HPA 메트릭 튜닝"
        - "스케일다운 지연 조정"
        - "예측 기반 스케일링"

  operational_efficiency:
    - name: "로깅 최적화"
      description: "필요한 로그만 저장"
      potential_savings: "10-20% (storage)"
      implementation:
        - "로그 레벨 조정"
        - "샘플링 적용"
        - "보관 기간 최적화"

    - name: "메트릭 카디널리티 관리"
      description: "불필요한 레이블 제거"
      potential_savings: "5-10% (monitoring)"
      implementation:
        - "레이블 감사"
        - "집계 규칙 적용"
```

---

## 6. 다음 단계

- [프로덕션 체크리스트](./production-checklist) - 운영 준비 확인
- [스케일링 전략](../deployment/scaling) - 효율적인 스케일링
- [모니터링 설정](../implementation/metrics) - 비용 메트릭 수집
