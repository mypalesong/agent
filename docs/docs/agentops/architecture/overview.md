---
sidebar_position: 1
title: "아키텍처 개요"
description: "AgentOps 플랫폼의 전체 시스템 아키텍처"
---

# AgentOps 아키텍처 개요

AgentOps 플랫폼은 AI 에이전트의 생명주기 전체를 관리하기 위한 **확장 가능하고 관찰 가능한** 시스템 아키텍처를 제공합니다.

---

## 1. 설계 원칙

### 1.1 핵심 설계 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│                  AgentOps Design Principles                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🎯 Separation of Concerns                                       │
│  └── Control / Observability / Data 계층 분리                   │
│                                                                  │
│  📊 Observability First                                          │
│  └── 모든 에이전트 행동은 추적 가능해야 함                      │
│                                                                  │
│  🔄 Scalability by Design                                        │
│  └── 수평 확장 가능한 상태 비저장 컴포넌트                      │
│                                                                  │
│  🔒 Security by Default                                          │
│  └── Zero Trust, 최소 권한 원칙                                 │
│                                                                  │
│  💰 Cost Awareness                                               │
│  └── 토큰 사용량 추적 및 최적화 내장                            │
│                                                                  │
│  🔌 Extensibility                                                │
│  └── 플러그인 아키텍처로 기능 확장 가능                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 아키텍처 품질 속성

| 속성 | 설명 | 목표 |
|------|------|------|
| **가용성** | 시스템 정상 운영 시간 | 99.9% uptime |
| **확장성** | 부하에 따른 수평 확장 | 1000+ agents/cluster |
| **지연시간** | 관찰 데이터 수집 지연 | < 100ms p95 |
| **내구성** | 데이터 손실 방지 | 99.99% durability |
| **보안성** | 데이터 및 접근 보호 | SOC2 준수 |

---

## 2. 전체 시스템 아키텍처

### 2.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         External Systems                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Users   │  │  Admin   │  │ External │  │   LLM    │               │
│  │(Clients) │  │  Portal  │  │   APIs   │  │ Providers│               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
└───────┼─────────────┼─────────────┼─────────────┼──────────────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          API Gateway Layer                              │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Rate Limiting │ Authentication │ Load Balancing │ TLS Termination│ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            CONTROL PLANE                                │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │  Agent   │ │  Config  │ │  Policy  │ │ Secrets  │          │   │
│  │  │ Registry │ │  Server  │ │  Engine  │ │  Vault   │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Version  │ │ Feature  │ │   RBAC   │ │ Workflow │          │   │
│  │  │ Control  │ │   Flags  │ │ Manager  │ │  Engine  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY LAYER                             │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Tracing  │ │ Metrics  │ │ Logging  │ │   Eval   │          │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Alerting │ │Dashboard │ │   Cost   │ │ Anomaly  │          │   │
│  │  │  Engine  │ │ Service  │ │ Tracker  │ │ Detector │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            DATA PLANE                                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Runtime Cluster                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │Runtime 1│ │Runtime 2│ │Runtime 3│ │Runtime 4│ │Runtime N│  │   │
│  │  │┌───────┐│ │┌───────┐│ │┌───────┐│ │┌───────┐│ │┌───────┐│  │   │
│  │  ││Agent A││ ││Agent B││ ││Agent C││ ││Agent D││ ││Agent E││  │   │
│  │  │└───────┘│ │└───────┘│ │└───────┘│ │└───────┘│ │└───────┘│  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              Agent-to-Agent Communication Bus                   │   │
│  │   (Pub/Sub | Request-Response | Event Streaming)               │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │PostgreSQL│ │  Redis   │ │ClickHouse│ │   S3/   │ │  Vector  │    │
│  │ (Config) │ │ (Cache)  │ │ (Traces) │ │  Minio  │ │   DB     │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 계층별 책임

| 계층 | 책임 | 핵심 특성 |
|------|------|----------|
| **API Gateway** | 인증, 라우팅, 속도 제한 | 무상태, 수평 확장 |
| **Control Plane** | 설정, 정책, 버전 관리 | 일관성 중시 |
| **Observability** | 추적, 메트릭, 로깅 | 고처리량, 낮은 지연 |
| **Data Plane** | 에이전트 실행, A2A 통신 | 격리, 탄력성 |
| **Storage** | 데이터 영속성 | 내구성, 쿼리 성능 |

---

## 3. 데이터 흐름

### 3.1 요청 처리 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Request Processing Flow                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User Request                                                         │
│     │                                                                    │
│     ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ API Gateway                                                      │   │
│  │ • Authenticate (JWT/API Key)                                    │   │
│  │ • Rate limit check                                               │   │
│  │ • Generate Trace ID                                              │   │
│  └───────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                      │
│     2. Route to Agent             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Agent Router                                                     │   │
│  │ • Policy check (Control Plane)                                  │   │
│  │ • Load balancing                                                 │   │
│  │ • Session affinity                                               │   │
│  └───────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                      │
│     3. Execute Agent              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Agent Runtime                                                    │   │
│  │ ┌─────────────────────────────────────────────────────────────┐ │   │
│  │ │ Input Guardrails → Agent Logic → Output Guardrails          │ │   │
│  │ │        ↓              ↓              ↓                      │ │   │
│  │ │    Validate      LLM Calls       Validate                   │ │   │
│  │ │                  Tool Use                                    │ │   │
│  │ │                  Reasoning                                   │ │   │
│  │ └─────────────────────────────────────────────────────────────┘ │   │
│  │ • Emit traces (every span)                                      │   │
│  │ • Emit metrics (latency, tokens, costs)                        │   │
│  │ • Emit logs (structured)                                        │   │
│  └───────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                      │
│     4. Collect Telemetry          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Observability Collector                                          │   │
│  │ • Batch traces                                                   │   │
│  │ • Aggregate metrics                                              │   │
│  │ • Index logs                                                     │   │
│  │ • Trigger evaluations                                            │   │
│  └───────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                      │
│     5. Response                   ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Response with metadata                                           │   │
│  │ • Result                                                         │   │
│  │ • Trace ID                                                       │   │
│  │ • Latency                                                        │   │
│  │ • Token usage                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 텔레메트리 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Telemetry Data Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Agent Runtime                 Collector                  Storage       │
│                                                                          │
│   ┌─────────┐                  ┌─────────┐               ┌─────────┐   │
│   │ Traces  │ ──── OTLP ────▶ │  OTEL   │ ────────────▶ │Jaeger/  │   │
│   │ Spans   │                  │Collector│               │Tempo    │   │
│   └─────────┘                  └─────────┘               └─────────┘   │
│                                     │                                    │
│   ┌─────────┐                       │                    ┌─────────┐   │
│   │ Metrics │ ── Prometheus ──▶     │     ──────────────▶│Prometheus│   │
│   │ Points  │    Remote Write       │                    │  /VictoriaMetrics│
│   └─────────┘                       │                    └─────────┘   │
│                                     │                                    │
│   ┌─────────┐                       │                    ┌─────────┐   │
│   │  Logs   │ ───── Fluentd ──▶     │     ──────────────▶│  Loki/  │   │
│   │(JSON)   │                       │                    │Elasticsearch│
│   └─────────┘                       │                    └─────────┘   │
│                                     │                                    │
│   ┌─────────┐                       │                    ┌─────────┐   │
│   │ Evals   │ ───── gRPC ─────▶     │     ──────────────▶│ClickHouse│   │
│   │ Results │                       │                    │/PostgreSQL│
│   └─────────┘                       │                    └─────────┘   │
│                                     │                                    │
│                                     ▼                                    │
│                            ┌─────────────┐                              │
│                            │  Dashboard  │                              │
│                            │  (Grafana)  │                              │
│                            └─────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 컴포넌트 상호작용

### 4.1 에이전트 등록 흐름

```python
# Agent Registration Sequence
from dataclasses import dataclass
from typing import List, Dict
from enum import Enum

class AgentStatus(Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    DISABLED = "disabled"

@dataclass
class AgentCard:
    """A2A 프로토콜 호환 에이전트 카드"""
    agent_id: str
    name: str
    version: str
    capabilities: List[str]
    input_schema: Dict
    output_schema: Dict
    dependencies: List[str]
    health_endpoint: str
    metrics_endpoint: str

class AgentRegistry:
    """Control Plane: Agent Registry Service"""

    async def register_agent(self, card: AgentCard) -> RegistrationResult:
        """
        에이전트 등록 프로세스

        1. 스키마 검증
        2. 중복 체크
        3. 의존성 확인
        4. 정책 평가
        5. 레지스트리 저장
        6. 이벤트 발행
        """
        # 1. Validate schema
        validation = await self._validate_agent_card(card)
        if not validation.valid:
            return RegistrationResult(
                success=False,
                error=validation.error
            )

        # 2. Check for duplicates
        existing = await self._find_agent(card.agent_id)
        if existing:
            return RegistrationResult(
                success=False,
                error=f"Agent {card.agent_id} already exists"
            )

        # 3. Verify dependencies
        dep_check = await self._verify_dependencies(card.dependencies)
        if not dep_check.satisfied:
            return RegistrationResult(
                success=False,
                error=f"Unsatisfied dependencies: {dep_check.missing}"
            )

        # 4. Evaluate policies
        policy_decision = await self.policy_engine.evaluate(
            action="register_agent",
            resource=card
        )
        if not policy_decision.allow:
            return RegistrationResult(
                success=False,
                error=policy_decision.reason
            )

        # 5. Store in registry
        agent_record = AgentRecord(
            card=card,
            status=AgentStatus.PENDING,
            registered_at=datetime.utcnow()
        )
        await self.storage.save(agent_record)

        # 6. Publish event
        await self.event_bus.publish(
            "agent.registered",
            {"agent_id": card.agent_id, "version": card.version}
        )

        return RegistrationResult(
            success=True,
            agent_id=card.agent_id
        )
```

### 4.2 런타임 통신 패턴

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Runtime Communication Patterns                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Pattern 1: Request-Response (Synchronous)                               │
│  ┌─────────┐      Request       ┌─────────┐                            │
│  │ Agent A │ ─────────────────▶ │ Agent B │                            │
│  │         │ ◀───────────────── │         │                            │
│  └─────────┘      Response      └─────────┘                            │
│                                                                          │
│  Pattern 2: Pub/Sub (Event-Driven)                                       │
│  ┌─────────┐                    ┌─────────┐                            │
│  │ Agent A │ ──── Publish ────▶ │   Bus   │ ───── Notify ────▶ Subscribers│
│  └─────────┘     "task.done"    └─────────┘                            │
│                                                                          │
│  Pattern 3: Task Delegation                                              │
│  ┌─────────┐   Delegate Task    ┌─────────┐                            │
│  │Orchestr.│ ─────────────────▶ │ Worker  │                            │
│  │         │                    │  Pool   │                            │
│  │         │ ◀───────────────── │         │                            │
│  └─────────┘    Task Result     └─────────┘                            │
│                                                                          │
│  Pattern 4: Streaming                                                    │
│  ┌─────────┐   Token Stream     ┌─────────┐                            │
│  │   LLM   │ ═══════════════▶  │ Client  │                            │
│  │Provider │    (WebSocket)     │         │                            │
│  └─────────┘                    └─────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 확장성 설계

### 5.1 수평 확장 전략

```yaml
# Kubernetes HPA 설정 예시
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-runtime-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-runtime
  minReplicas: 3
  maxReplicas: 100
  metrics:
    # CPU 기반 스케일링
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # 메모리 기반 스케일링
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # 커스텀 메트릭: 큐 깊이
    - type: Pods
      pods:
        metric:
          name: agent_request_queue_depth
        target:
          type: AverageValue
          averageValue: "30"

    # 커스텀 메트릭: 활성 세션 수
    - type: Pods
      pods:
        metric:
          name: agent_active_sessions
        target:
          type: AverageValue
          averageValue: "50"

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### 5.2 데이터 파티셔닝

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Data Partitioning Strategy                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Traces / Logs: Time-based partitioning                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │2024-12-01│ │2024-12-02│ │2024-12-03│ │2024-12-04│ ...               │
│  │ Traces   │ │ Traces   │ │ Traces   │ │ Traces   │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                          │
│  Agent Configs: Agent-ID based sharding                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                │
│  │ Shard 0  │ │ Shard 1  │ │ Shard 2  │                                │
│  │agent_0-99│ │agent_100-│ │agent_200-│                                │
│  └──────────┘ └──────────┘ └──────────┘                                │
│                                                                          │
│  Metrics: Label-based bucketing                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  agent="A" │ agent="B" │ agent="C" │ ... │ (cardinality limits)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 고가용성 설계

### 6.1 다중 영역 배포

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Multi-Zone Deployment                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                    ┌─────────────────────┐                              │
│                    │   Global Load       │                              │
│                    │   Balancer (GLB)    │                              │
│                    └──────────┬──────────┘                              │
│                               │                                          │
│         ┌─────────────────────┼─────────────────────┐                   │
│         │                     │                     │                   │
│         ▼                     ▼                     ▼                   │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐             │
│  │   Zone A    │      │   Zone B    │      │   Zone C    │             │
│  │  (Primary)  │      │ (Secondary) │      │   (DR)      │             │
│  │             │      │             │      │             │             │
│  │ ┌─────────┐ │      │ ┌─────────┐ │      │ ┌─────────┐ │             │
│  │ │Control  │ │ ◀──▶ │ │Control  │ │ ◀──▶ │ │Control  │ │             │
│  │ │ Plane   │ │ Sync │ │ Plane   │ │ Sync │ │ Plane   │ │             │
│  │ └─────────┘ │      │ └─────────┘ │      │ └─────────┘ │             │
│  │ ┌─────────┐ │      │ ┌─────────┐ │      │ ┌─────────┐ │             │
│  │ │ Data    │ │      │ │ Data    │ │      │ │ Data    │ │             │
│  │ │ Plane   │ │      │ │ Plane   │ │      │ │ Plane   │ │             │
│  │ └─────────┘ │      │ └─────────┘ │      │ └─────────┘ │             │
│  │             │      │             │      │             │             │
│  │ ┌─────────┐ │      │ ┌─────────┐ │      │ ┌─────────┐ │             │
│  │ │Database │ │──────│▶│ Replica │ │──────│▶│ Replica │ │             │
│  │ │(Primary)│ │      │ │(Hot SB) │ │      │ │(Warm SB)│ │             │
│  │ └─────────┘ │      │ └─────────┘ │      │ └─────────┘ │             │
│  └─────────────┘      └─────────────┘      └─────────────┘             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 장애 복구 전략

| 장애 유형 | RTO | RPO | 복구 전략 |
|----------|-----|-----|----------|
| Pod 장애 | < 30s | 0 | K8s 자동 재시작 |
| Node 장애 | < 2m | 0 | Pod 재스케줄링 |
| Zone 장애 | < 5m | < 1m | Zone 페일오버 |
| Region 장애 | < 30m | < 5m | DR 사이트 활성화 |
| 데이터 손상 | < 1h | < 1h | Point-in-time 복구 |

---

## 7. 다음 단계

각 계층의 상세 설계는 다음 문서에서 확인하세요:

- [Control Plane 설계](./control-plane) - 설정, 정책, 버전 관리
- [Observability Layer 설계](./observability-layer) - 추적, 메트릭, 로깅
- [Data Plane 설계](./data-plane) - Agent Runtime, A2A 통신
