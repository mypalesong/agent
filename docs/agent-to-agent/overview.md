---
sidebar_position: 1
title: "Agent-to-Agent (A2A) 프로토콜"
description: "에이전트 간 통신을 위한 표준 프로토콜과 상호운용성"
---

# Agent-to-Agent (A2A) 프로토콜

![Agent Network](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=80)

*Figure: Interconnected Agent Networks - The Future of AI Communication*

> "2026년의 AI 생태계는 고립된 에이전트들의 집합이 아니라, 유기적으로 협력하는 에이전트 네트워크가 될 것이다."

---

## 1. 개요

### 1.1 A2A란 무엇인가?

**Agent-to-Agent (A2A)** 프로토콜은 서로 다른 AI 에이전트들이 **상호 발견, 협상, 그리고 협력**할 수 있도록 하는 표준화된 통신 규약이다.

```
┌─────────────────────────────────────────────────────────────┐
│                    A2A 프로토콜 개요                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────┐         A2A Protocol         ┌─────────┐      │
│   │ Agent A │ ←─────────────────────────→ │ Agent B │      │
│   │ (여행)  │    • Discovery              │ (예약)  │      │
│   └─────────┘    • Negotiation            └─────────┘      │
│        ↑         • Task Delegation              ↑          │
│        │         • Result Exchange              │          │
│        │                                        │          │
│        └────────────────┬───────────────────────┘          │
│                         │                                   │
│                    ┌─────────┐                              │
│                    │ Agent C │                              │
│                    │ (결제)  │                              │
│                    └─────────┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 A2A의 필요성

현재 AI 에이전트 생태계의 문제점:

| 문제 | 설명 | A2A 해결책 |
|------|------|-----------|
| **사일로화** | 각 에이전트가 독립적으로 작동 | 표준 통신 프로토콜 |
| **비호환성** | 다른 벤더 에이전트 간 협력 불가 | 공통 메시지 형식 |
| **중복 작업** | 유사한 기능의 반복 구현 | 기능 재사용 및 위임 |
| **확장성 한계** | 단일 에이전트의 능력 제한 | 분산 협력 아키텍처 |

### 1.3 A2A vs MCP (Model Context Protocol)

```
┌────────────────────────────────────────────────────────────┐
│              A2A와 MCP의 관계                               │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  MCP (Model Context Protocol)                               │
│  ┌─────────────────────────────────────────┐               │
│  │  • 에이전트 ↔ 도구/리소스 연결          │               │
│  │  • 단일 에이전트의 능력 확장            │               │
│  │  • 도구 제공자 관점                     │               │
│  └─────────────────────────────────────────┘               │
│                       ↓                                     │
│                  상호 보완                                  │
│                       ↓                                     │
│  A2A (Agent-to-Agent)                                       │
│  ┌─────────────────────────────────────────┐               │
│  │  • 에이전트 ↔ 에이전트 통신             │               │
│  │  • 멀티에이전트 협업                    │               │
│  │  • 에이전트 제공자 관점                 │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 2. A2A 프로토콜 아키텍처

### 2.1 핵심 구성 요소

```
┌─────────────────────────────────────────────────────────────┐
│                   A2A PROTOCOL STACK                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 4: Application                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Domain-Specific Protocols (Travel, Finance, etc.)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  Layer 3: Collaboration                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Task Negotiation | Workflow Orchestration          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  Layer 2: Communication                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Message Format | State Management | Error Handling │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  Layer 1: Discovery                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Agent Cards | Capability Registry | Authentication │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  Layer 0: Transport                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTTP/HTTPS | WebSocket | gRPC                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Agent Card (에이전트 카드)

Agent Card는 에이전트의 **신원과 능력을 공개적으로 선언**하는 메타데이터 문서이다:

```json
{
  "$schema": "https://a2a-protocol.org/schemas/agent-card/v1",
  "id": "agent://travel-planner.example.com",
  "name": "TravelPlannerAgent",
  "version": "2.1.0",
  "description": "Comprehensive travel planning and booking agent",

  "provider": {
    "organization": "TravelTech Inc.",
    "contact": "agents@traveltech.com",
    "homepage": "https://traveltech.com/agents"
  },

  "capabilities": [
    {
      "name": "flight_search",
      "description": "Search and compare flight options",
      "input_schema": {
        "type": "object",
        "properties": {
          "origin": { "type": "string", "format": "iata-code" },
          "destination": { "type": "string", "format": "iata-code" },
          "departure_date": { "type": "string", "format": "date" },
          "return_date": { "type": "string", "format": "date" },
          "passengers": { "type": "integer", "minimum": 1 }
        },
        "required": ["origin", "destination", "departure_date"]
      },
      "output_schema": {
        "type": "array",
        "items": { "$ref": "#/definitions/FlightOption" }
      },
      "estimated_duration": "PT5S",
      "cost_model": {
        "type": "per_request",
        "amount": 0.001,
        "currency": "USD"
      }
    },
    {
      "name": "hotel_booking",
      "description": "Search and book hotel accommodations",
      "input_schema": { "..." },
      "output_schema": { "..." }
    },
    {
      "name": "itinerary_planning",
      "description": "Create optimized travel itineraries",
      "input_schema": { "..." },
      "output_schema": { "..." }
    }
  ],

  "authentication": {
    "methods": ["oauth2", "api_key"],
    "oauth2_config": {
      "authorization_url": "https://auth.traveltech.com/authorize",
      "token_url": "https://auth.traveltech.com/token",
      "scopes": ["read:flights", "book:hotels"]
    }
  },

  "sla": {
    "availability": "99.9%",
    "max_response_time": "PT30S",
    "rate_limits": {
      "requests_per_minute": 100,
      "requests_per_day": 10000
    }
  },

  "trust_indicators": {
    "verified": true,
    "certifications": ["ISO27001", "SOC2"],
    "reputation_score": 4.8,
    "total_transactions": 1250000
  }
}
```

### 2.3 메시지 형식

A2A 프로토콜의 표준 메시지 형식:

```typescript
interface A2AMessage {
  // 메시지 메타데이터
  header: {
    message_id: string;          // 고유 메시지 ID
    correlation_id?: string;     // 관련 메시지 추적용
    timestamp: string;           // ISO 8601 형식
    sender: AgentIdentifier;     // 발신 에이전트
    receiver: AgentIdentifier;   // 수신 에이전트
    message_type: MessageType;   // 메시지 유형
    version: string;             // 프로토콜 버전
  };

  // 메시지 본문
  body: {
    action?: string;             // 요청 액션
    parameters?: object;         // 액션 파라미터
    result?: object;             // 응답 결과
    error?: A2AError;            // 에러 정보
    context?: ConversationContext; // 대화 맥락
  };

  // 보안 정보
  security?: {
    signature: string;           // 디지털 서명
    encryption?: EncryptionInfo; // 암호화 정보
    auth_token?: string;         // 인증 토큰
  };
}

type MessageType =
  | "request"           // 작업 요청
  | "response"          // 작업 응답
  | "notification"      // 알림
  | "negotiation"       // 협상
  | "heartbeat"         // 상태 확인
  | "error";            // 에러
```

---

## 3. A2A 통신 패턴

### 3.1 요청-응답 패턴 (Request-Response)

가장 기본적인 통신 패턴:

```
Client Agent                           Service Agent
     │                                       │
     │  ─────── Request Message ──────────→ │
     │                                       │
     │                                [Processing]
     │                                       │
     │  ←────── Response Message ─────────  │
     │                                       │
```

```python
# Python 예제: 항공편 검색 요청
import asyncio
from a2a_client import A2AClient

async def search_flights():
    client = A2AClient()

    # 여행 에이전트 발견
    travel_agent = await client.discover(
        capability="flight_search",
        filters={"min_reputation": 4.5}
    )

    # 요청 전송
    response = await client.request(
        agent=travel_agent,
        action="flight_search",
        parameters={
            "origin": "ICN",
            "destination": "NRT",
            "departure_date": "2026-03-15",
            "passengers": 2
        }
    )

    return response.result["flights"]
```

### 3.2 위임 패턴 (Delegation)

복잡한 작업을 다른 에이전트에게 위임:

```
Orchestrator                  Worker Agent A              Worker Agent B
     │                              │                           │
     │ ─── Delegate Task 1 ──────→ │                           │
     │                              │                           │
     │ ─── Delegate Task 2 ─────────────────────────────────→ │
     │                              │                           │
     │                        [Processing]               [Processing]
     │                              │                           │
     │ ←── Task 1 Result ────────  │                           │
     │                              │                           │
     │ ←── Task 2 Result ──────────────────────────────────── │
     │                              │                           │
     │                                                          │
   [Aggregate Results]                                          │
     │                                                          │
```

```typescript
// TypeScript 예제: 여행 계획 오케스트레이션
class TravelOrchestratorAgent {
  async planTrip(tripRequest: TripRequest): Promise<TripPlan> {
    // 1. 관련 에이전트 발견
    const [flightAgent, hotelAgent, activityAgent] = await Promise.all([
      this.discover({ capability: "flight_search" }),
      this.discover({ capability: "hotel_booking" }),
      this.discover({ capability: "activity_recommendation" })
    ]);

    // 2. 병렬로 작업 위임
    const [flights, hotels, activities] = await Promise.all([
      this.delegate(flightAgent, "search_flights", {
        origin: tripRequest.origin,
        destination: tripRequest.destination,
        dates: tripRequest.dates
      }),
      this.delegate(hotelAgent, "search_hotels", {
        location: tripRequest.destination,
        dates: tripRequest.dates,
        guests: tripRequest.travelers
      }),
      this.delegate(activityAgent, "recommend_activities", {
        destination: tripRequest.destination,
        interests: tripRequest.interests,
        duration: tripRequest.duration
      })
    ]);

    // 3. 결과 통합
    return this.createTripPlan(flights, hotels, activities);
  }
}
```

### 3.3 협상 패턴 (Negotiation)

에이전트 간 조건 협상:

```
Agent A                                              Agent B
   │                                                    │
   │  ──── Proposal (initial offer) ────────────────→  │
   │                                                    │
   │                                           [Evaluate]
   │                                                    │
   │  ←─── Counter-Proposal (modified terms) ────────  │
   │                                                    │
   [Evaluate]                                           │
   │                                                    │
   │  ──── Accept / Reject / Counter ───────────────→  │
   │                                                    │
   │                    ... (negotiation rounds) ...    │
   │                                                    │
   │  ←───────── Agreement / Failure ────────────────  │
   │                                                    │
```

```python
# 협상 프로토콜 예제
class NegotiationProtocol:
    """
    Contract Net Protocol 기반 협상
    """

    async def negotiate(self,
                       task: Task,
                       candidates: List[Agent]) -> NegotiationResult:
        # 1. 입찰 요청 (Call for Proposals)
        proposals = await self.broadcast_cfp(task, candidates)

        # 2. 제안 평가
        ranked_proposals = self.evaluate_proposals(proposals)

        # 3. 협상 라운드
        best_proposal = None
        for proposal in ranked_proposals:
            # 조건 협상
            negotiation = await self.negotiate_terms(
                proposal.agent,
                task.requirements,
                proposal.terms
            )

            if negotiation.success:
                best_proposal = negotiation.final_agreement
                break

        if not best_proposal:
            return NegotiationResult(success=False)

        # 4. 계약 체결
        contract = await self.form_contract(best_proposal)
        return NegotiationResult(success=True, contract=contract)

    def evaluate_proposals(self,
                          proposals: List[Proposal]) -> List[Proposal]:
        """
        다중 기준 의사결정 (MCDM)을 통한 제안 평가
        """
        criteria = {
            "price": 0.3,          # 가격 가중치
            "quality": 0.25,       # 품질 가중치
            "speed": 0.25,         # 속도 가중치
            "reliability": 0.2    # 신뢰성 가중치
        }

        scored_proposals = []
        for proposal in proposals:
            score = sum(
                weight * self.normalize(proposal.get(criterion))
                for criterion, weight in criteria.items()
            )
            scored_proposals.append((score, proposal))

        return [p for _, p in sorted(scored_proposals, reverse=True)]
```

### 3.4 pub/sub 패턴 (Event Streaming)

이벤트 기반 비동기 통신:

```
┌──────────────────────────────────────────────────────────────┐
│                    Event Bus / Message Broker                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Publisher A        Topic: "booking.created"                │
│       │                      │                               │
│       └─── Event ────→ ┌─────┴─────┐                         │
│                         │   Topic   │                         │
│                         └─────┬─────┘                         │
│                               │                               │
│                    ┌──────────┼──────────┐                   │
│                    │          │          │                   │
│                    ↓          ↓          ↓                   │
│             Subscriber    Subscriber  Subscriber             │
│                 B             C           D                   │
│             (결제)        (알림)       (분석)                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. A2A 선별 조건 (Prerequisites)

### 4.1 기술적 요구사항

에이전트가 A2A 네트워크에 참여하기 위한 기술적 조건:

```
┌─────────────────────────────────────────────────────────────┐
│              A2A 참여를 위한 기술적 요구사항                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 프로토콜 준수 (Protocol Compliance)                      │
│     ├─ Agent Card 표준 준수                                 │
│     ├─ 메시지 형식 호환성                                   │
│     └─ 버전 호환성 관리                                     │
│                                                              │
│  2. 통신 인프라 (Communication Infrastructure)               │
│     ├─ HTTPS/TLS 1.3 지원                                   │
│     ├─ WebSocket 실시간 통신                                │
│     └─ 안정적인 엔드포인트                                  │
│                                                              │
│  3. 보안 요구사항 (Security Requirements)                    │
│     ├─ 디지털 서명 (Ed25519, RSA-2048)                      │
│     ├─ 암호화 통신                                          │
│     ├─ 인증/인가 메커니즘                                   │
│     └─ 감사 로깅                                            │
│                                                              │
│  4. 가용성 (Availability)                                    │
│     ├─ 99.9% uptime SLA                                     │
│     ├─ 응답 시간 보장                                       │
│     └─ 장애 복구 계획                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 신뢰 수준 (Trust Levels)

A2A 네트워크에서의 에이전트 신뢰 등급:

| Level | 이름 | 요구사항 | 허용 작업 |
|-------|------|---------|----------|
| **L0** | Unknown | 없음 | 공개 정보 조회만 |
| **L1** | Registered | 기본 인증 완료 | 읽기 전용 API 호출 |
| **L2** | Verified | 신원 확인 + 테스트 통과 | 표준 작업 위임 |
| **L3** | Trusted | 보안 감사 통과 | 민감한 데이터 접근 |
| **L4** | Certified | 공식 인증 획득 | 무제한 협업 |

### 4.3 역량 요구사항

```python
@dataclass
class A2ACapabilityRequirements:
    """
    A2A 네트워크 참여를 위한 역량 요구사항
    """

    # 필수 역량
    required_capabilities: List[str] = field(default_factory=lambda: [
        "handle_request_response",    # 기본 요청-응답 처리
        "provide_agent_card",         # Agent Card 제공
        "support_health_check",       # 상태 확인 응답
        "handle_errors_gracefully",   # 에러 처리
        "maintain_session_state",     # 세션 상태 관리
    ])

    # 권장 역량
    recommended_capabilities: List[str] = field(default_factory=lambda: [
        "support_streaming",          # 스트리밍 응답
        "support_batch_requests",     # 배치 요청 처리
        "provide_progress_updates",   # 진행 상황 보고
        "support_cancellation",       # 작업 취소
        "maintain_audit_log",         # 감사 로그 유지
    ])

    # 고급 역량
    advanced_capabilities: List[str] = field(default_factory=lambda: [
        "support_negotiation",        # 협상 프로토콜
        "support_multi_party",        # 다자간 협업
        "provide_sla_guarantees",     # SLA 보장
        "support_compensation",       # 보상 트랜잭션
    ])
```

---

## 5. 환경 구축

### 5.1 A2A 개발 환경 설정

```bash
# A2A SDK 설치
npm install @a2a-protocol/sdk

# 또는 Python
pip install a2a-protocol

# 개발 서버 시작
a2a dev --port 3000 --agent-card ./agent-card.json
```

### 5.2 Agent Card 생성 도구

```typescript
// agent-card-generator.ts
import { AgentCardBuilder } from '@a2a-protocol/sdk';

const agentCard = new AgentCardBuilder()
  .setId('agent://my-agent.example.com')
  .setName('MyCustomAgent')
  .setVersion('1.0.0')
  .setDescription('A custom agent for demonstration')
  .addCapability({
    name: 'greet',
    description: 'Greet a user',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    },
    outputSchema: {
      type: 'object',
      properties: {
        greeting: { type: 'string' }
      }
    }
  })
  .setAuthentication({
    methods: ['api_key'],
    apiKeyHeader: 'X-API-Key'
  })
  .build();

// Agent Card 저장
await agentCard.save('./agent-card.json');
```

### 5.3 A2A 서버 구현

```python
# a2a_server.py
from a2a_protocol import A2AServer, handler, AgentContext

class MyAgent(A2AServer):
    """
    기본 A2A 에이전트 서버 구현
    """

    def __init__(self):
        super().__init__(
            agent_card_path="./agent-card.json"
        )

    @handler("greet")
    async def handle_greet(self,
                           ctx: AgentContext,
                           name: str) -> dict:
        """
        인사 요청 처리
        """
        return {
            "greeting": f"Hello, {name}! I'm {self.name}."
        }

    @handler("process_task")
    async def handle_task(self,
                         ctx: AgentContext,
                         task: dict) -> dict:
        """
        작업 처리 - 다른 에이전트에 위임 가능
        """
        if task.get("requires_specialist"):
            # 전문 에이전트 발견 및 위임
            specialist = await ctx.discover(
                capability=task["required_capability"]
            )
            result = await ctx.delegate(
                agent=specialist,
                action=task["action"],
                parameters=task["parameters"]
            )
            return result

        # 직접 처리
        return await self.process_locally(task)


if __name__ == "__main__":
    agent = MyAgent()
    agent.run(port=3000)
```

---

## 6. 실전 예제: 멀티에이전트 여행 예약 시스템

### 6.1 시스템 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│                  Multi-Agent Travel Booking System             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Interface                                                │
│        │                                                        │
│        ↓                                                        │
│   ┌─────────────┐                                               │
│   │ Orchestrator│←──────────────────────────────────┐          │
│   │   Agent     │                                   │          │
│   └──────┬──────┘                                   │          │
│          │                                          │          │
│    ┌─────┴─────┬─────────────┬─────────────┐       │          │
│    ↓           ↓             ↓             ↓       │          │
│ ┌──────┐  ┌──────┐      ┌──────┐      ┌──────┐    │          │
│ │Flight│  │Hotel │      │Activity│    │Payment│   │          │
│ │Agent │  │Agent │      │Agent  │     │Agent │    │          │
│ └──┬───┘  └──┬───┘      └──┬───┘      └──┬───┘    │          │
│    │         │             │             │        │          │
│    ↓         ↓             ↓             ↓        │          │
│ [Airline] [Hotel     [Activity      [Payment     [Feedback   │
│   APIs]   Booking     Providers]     Gateway]    Loop]       │
│            APIs]                                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 전체 구현 코드

```python
# travel_booking_system.py
import asyncio
from typing import List, Dict, Optional
from dataclasses import dataclass
from a2a_protocol import A2AClient, A2AServer, handler

@dataclass
class TravelRequest:
    origin: str
    destination: str
    departure_date: str
    return_date: str
    travelers: int
    budget: float
    preferences: Dict

@dataclass
class TravelPlan:
    flights: List[Dict]
    hotel: Dict
    activities: List[Dict]
    total_cost: float
    booking_id: str


class TravelOrchestratorAgent(A2AServer):
    """
    여행 예약 오케스트레이터 에이전트
    다른 전문 에이전트들을 조율하여 완전한 여행 계획 수립
    """

    def __init__(self):
        super().__init__(agent_card_path="./orchestrator-card.json")
        self.client = A2AClient()

    @handler("plan_trip")
    async def plan_trip(self, ctx, request: TravelRequest) -> TravelPlan:
        """
        전체 여행 계획 수립 프로세스
        """
        # 1. 전문 에이전트 발견
        agents = await self._discover_agents()

        # 2. 병렬로 옵션 수집
        options = await self._gather_options(agents, request)

        # 3. 최적 조합 선택
        best_plan = await self._optimize_plan(options, request)

        # 4. 예약 확정
        confirmed_plan = await self._confirm_bookings(
            agents, best_plan, request
        )

        return confirmed_plan

    async def _discover_agents(self) -> Dict[str, 'Agent']:
        """관련 에이전트 발견"""
        flight_agent, hotel_agent, activity_agent, payment_agent = \
            await asyncio.gather(
                self.client.discover(capability="flight_search"),
                self.client.discover(capability="hotel_booking"),
                self.client.discover(capability="activity_search"),
                self.client.discover(capability="payment_processing")
            )

        return {
            "flight": flight_agent,
            "hotel": hotel_agent,
            "activity": activity_agent,
            "payment": payment_agent
        }

    async def _gather_options(self,
                             agents: Dict,
                             request: TravelRequest) -> Dict:
        """병렬로 옵션 수집"""

        flight_task = self.client.request(
            agent=agents["flight"],
            action="search_flights",
            parameters={
                "origin": request.origin,
                "destination": request.destination,
                "departure_date": request.departure_date,
                "return_date": request.return_date,
                "passengers": request.travelers
            }
        )

        hotel_task = self.client.request(
            agent=agents["hotel"],
            action="search_hotels",
            parameters={
                "location": request.destination,
                "check_in": request.departure_date,
                "check_out": request.return_date,
                "guests": request.travelers,
                "preferences": request.preferences.get("hotel", {})
            }
        )

        activity_task = self.client.request(
            agent=agents["activity"],
            action="search_activities",
            parameters={
                "destination": request.destination,
                "dates": {
                    "start": request.departure_date,
                    "end": request.return_date
                },
                "interests": request.preferences.get("interests", []),
                "group_size": request.travelers
            }
        )

        flights, hotels, activities = await asyncio.gather(
            flight_task, hotel_task, activity_task
        )

        return {
            "flights": flights.result,
            "hotels": hotels.result,
            "activities": activities.result
        }

    async def _optimize_plan(self,
                            options: Dict,
                            request: TravelRequest) -> Dict:
        """
        예산과 선호도를 고려한 최적 조합 선택
        """
        best_score = -1
        best_plan = None

        for flight in options["flights"][:5]:  # 상위 5개 항공편
            for hotel in options["hotels"][:5]:  # 상위 5개 호텔
                # 예산 확인
                base_cost = flight["price"] + hotel["total_price"]
                if base_cost > request.budget * 0.8:  # 활동 예산 20% 확보
                    continue

                # 활동 선택 (남은 예산 내)
                remaining_budget = request.budget - base_cost
                selected_activities = self._select_activities(
                    options["activities"],
                    remaining_budget,
                    request.preferences
                )

                # 점수 계산
                total_cost = base_cost + sum(
                    a["price"] for a in selected_activities
                )
                score = self._calculate_plan_score(
                    flight, hotel, selected_activities, request
                )

                if score > best_score:
                    best_score = score
                    best_plan = {
                        "flight": flight,
                        "hotel": hotel,
                        "activities": selected_activities,
                        "total_cost": total_cost
                    }

        return best_plan

    async def _confirm_bookings(self,
                               agents: Dict,
                               plan: Dict,
                               request: TravelRequest) -> TravelPlan:
        """예약 확정 및 결제 처리"""

        # 결제 처리
        payment_result = await self.client.request(
            agent=agents["payment"],
            action="process_payment",
            parameters={
                "amount": plan["total_cost"],
                "currency": "KRW",
                "items": [
                    {"type": "flight", "amount": plan["flight"]["price"]},
                    {"type": "hotel", "amount": plan["hotel"]["total_price"]},
                    *[{"type": "activity", "amount": a["price"]}
                      for a in plan["activities"]]
                ]
            }
        )

        if not payment_result.success:
            raise Exception("Payment failed")

        # 예약 확정
        booking_tasks = [
            self.client.request(
                agent=agents["flight"],
                action="book_flight",
                parameters={
                    "flight_id": plan["flight"]["id"],
                    "passengers": request.travelers,
                    "payment_ref": payment_result.result["transaction_id"]
                }
            ),
            self.client.request(
                agent=agents["hotel"],
                action="book_hotel",
                parameters={
                    "hotel_id": plan["hotel"]["id"],
                    "check_in": request.departure_date,
                    "check_out": request.return_date,
                    "payment_ref": payment_result.result["transaction_id"]
                }
            )
        ]

        flight_booking, hotel_booking = await asyncio.gather(*booking_tasks)

        return TravelPlan(
            flights=[flight_booking.result],
            hotel=hotel_booking.result,
            activities=plan["activities"],
            total_cost=plan["total_cost"],
            booking_id=payment_result.result["transaction_id"]
        )


# 실행
if __name__ == "__main__":
    orchestrator = TravelOrchestratorAgent()
    orchestrator.run(port=3000)
```

---

## 7. 보안 고려사항

### 7.1 인증 및 인가

```typescript
// 상호 인증 (Mutual Authentication)
interface A2AAuthentication {
  // 에이전트 신원 확인
  verifyAgentIdentity(agentCard: AgentCard): Promise<boolean>;

  // 요청 서명 검증
  verifyRequestSignature(
    message: A2AMessage,
    publicKey: string
  ): Promise<boolean>;

  // 권한 확인
  checkPermissions(
    callerAgent: AgentIdentifier,
    requestedAction: string,
    targetResource: string
  ): Promise<AuthorizationResult>;
}
```

### 7.2 보안 모범 사례

1. **최소 권한 원칙**: 필요한 최소한의 권한만 요청
2. **통신 암호화**: 모든 A2A 통신에 TLS 1.3 사용
3. **입력 검증**: 모든 수신 메시지 스키마 검증
4. **감사 로깅**: 모든 에이전트 상호작용 기록
5. **속도 제한**: DoS 공격 방지를 위한 요청 제한

---

## 8. 다음 단계

- [**AgentOps**](/docs/agentops/overview): 에이전트 운영 및 모니터링
- [**아키텍처 패턴**](/docs/architecture/patterns): 고급 설계 패턴
- [**실전 예제**](/docs/practical/case-studies): 더 많은 구현 사례
