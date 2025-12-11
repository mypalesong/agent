---
sidebar_position: 2
title: "컴플라이언스"
description: "AI 에이전트 시스템의 규정 준수 가이드"
---

# 컴플라이언스 가이드

AI 에이전트 운영 시 준수해야 할 규정과 모범 사례를 설명합니다.

---

## 1. 규정 준수 체계

### 1.1 주요 규정

| 규정 | 적용 대상 | 핵심 요구사항 |
|------|----------|--------------|
| **GDPR** | EU 사용자 데이터 | 데이터 처리 동의, 삭제권, 이동권 |
| **CCPA** | 캘리포니아 거주자 | 정보 공개, 판매 거부권 |
| **PIPA (개인정보보호법)** | 한국 개인정보 | 수집 동의, 안전조치, 파기 |
| **AI 규제 (EU AI Act)** | AI 시스템 | 위험 등급, 투명성, 인간 감독 |

### 1.2 AI 에이전트 위험 등급

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI Agent Risk Classification                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔴 Unacceptable Risk (금지)                                             │
│  └── 사회적 점수 매기기, 취약계층 착취, 실시간 생체 인식                 │
│                                                                          │
│  🟠 High Risk (엄격한 규제)                                               │
│  └── 의료 진단, 법적 조언, 채용 결정, 신용 평가                          │
│      → 적합성 평가, 데이터 거버넌스, 인간 감독 필수                      │
│                                                                          │
│  🟡 Limited Risk (투명성 의무)                                            │
│  └── 챗봇, 콘텐츠 생성, 고객 서비스                                      │
│      → AI 사용 고지, 딥페이크 라벨링                                     │
│                                                                          │
│  🟢 Minimal Risk (자유 사용)                                              │
│  └── 스팸 필터, 게임 AI, 추천 시스템                                     │
│      → 특별한 의무 없음                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 데이터 처리 규정

### 2.1 개인정보 처리 체크리스트

```yaml
# compliance-checklist.yaml

privacy_compliance:
  collection:
    - name: "수집 동의 확인"
      required: true
      description: "개인정보 수집 전 명시적 동의 획득"
      implementation: |
        - 동의 팝업/배너 구현
        - 동의 기록 저장
        - 철회 메커니즘 제공

    - name: "목적 제한"
      required: true
      description: "명시된 목적으로만 데이터 사용"
      implementation: |
        - 목적 코드화 및 태깅
        - 목적 외 사용 차단

    - name: "최소 수집"
      required: true
      description: "필요한 최소한의 데이터만 수집"
      implementation: |
        - 필수/선택 필드 구분
        - 불필요 데이터 비수집

  processing:
    - name: "처리 기록"
      required: true
      description: "모든 데이터 처리 활동 기록"

    - name: "접근 제어"
      required: true
      description: "권한 있는 자만 데이터 접근"

    - name: "암호화"
      required: true
      description: "저장 및 전송 시 암호화"

  retention:
    - name: "보관 기간"
      required: true
      description: "목적 달성 후 즉시 파기"
      policies:
        session_data: "세션 종료 시"
        conversation_logs: "90일"
        analytics_data: "2년"

    - name: "삭제권"
      required: true
      description: "사용자 요청 시 데이터 삭제"
      sla: "30일 이내"
```

### 2.2 데이터 처리 계약

```python
# agentops/compliance/data_processing.py

from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime
from enum import Enum

class LegalBasis(Enum):
    """데이터 처리 법적 근거"""
    CONSENT = "consent"                    # 동의
    CONTRACT = "contract"                  # 계약 이행
    LEGAL_OBLIGATION = "legal_obligation"  # 법적 의무
    VITAL_INTEREST = "vital_interest"      # 중대한 이익
    PUBLIC_TASK = "public_task"            # 공익
    LEGITIMATE_INTEREST = "legitimate"     # 정당한 이익

class ProcessingPurpose(Enum):
    """처리 목적"""
    SERVICE_PROVISION = "service_provision"
    ANALYTICS = "analytics"
    IMPROVEMENT = "improvement"
    MARKETING = "marketing"
    LEGAL_COMPLIANCE = "legal_compliance"

@dataclass
class ConsentRecord:
    """동의 기록"""
    user_id: str
    purpose: ProcessingPurpose
    legal_basis: LegalBasis
    granted_at: datetime
    expires_at: Optional[datetime]
    version: str  # 동의 버전
    ip_address: str
    user_agent: str

class ConsentManager:
    """동의 관리자"""

    async def record_consent(
        self,
        user_id: str,
        purposes: List[ProcessingPurpose],
        legal_basis: LegalBasis
    ) -> List[ConsentRecord]:
        """동의 기록"""
        records = []
        for purpose in purposes:
            record = ConsentRecord(
                user_id=user_id,
                purpose=purpose,
                legal_basis=legal_basis,
                granted_at=datetime.utcnow(),
                expires_at=None,
                version=self.current_consent_version,
                ip_address=self._get_client_ip(),
                user_agent=self._get_user_agent()
            )
            await self.storage.save(record)
            records.append(record)
        return records

    async def check_consent(
        self,
        user_id: str,
        purpose: ProcessingPurpose
    ) -> bool:
        """동의 여부 확인"""
        record = await self.storage.get_consent(user_id, purpose)
        if not record:
            return False
        if record.expires_at and record.expires_at < datetime.utcnow():
            return False
        return True

    async def revoke_consent(
        self,
        user_id: str,
        purposes: List[ProcessingPurpose] = None
    ):
        """동의 철회"""
        if purposes is None:
            purposes = list(ProcessingPurpose)

        for purpose in purposes:
            await self.storage.delete_consent(user_id, purpose)

        # 관련 데이터 삭제 트리거
        await self._trigger_data_deletion(user_id, purposes)
```

---

## 3. AI 투명성

### 3.1 AI 사용 고지

```python
# agentops/compliance/transparency.py

class AIDisclosure:
    """AI 사용 고지 관리"""

    DISCLOSURE_MESSAGE = """
이 서비스는 AI 기술을 활용합니다.

• AI 시스템: {agent_name}
• 사용 목적: {purpose}
• 데이터 사용: 대화 내용은 서비스 개선에 활용될 수 있습니다
• 한계: AI는 오류가 있을 수 있으며, 중요한 결정은 전문가와 상담하세요

자세한 내용: {privacy_policy_url}
"""

    async def get_disclosure(
        self,
        agent_id: str,
        language: str = "ko"
    ) -> str:
        """AI 사용 고지문 반환"""
        agent_info = await self.registry.get_agent(agent_id)

        return self.DISCLOSURE_MESSAGE.format(
            agent_name=agent_info.name,
            purpose=agent_info.purpose,
            privacy_policy_url=self.config.privacy_policy_url
        )

    async def log_disclosure_shown(
        self,
        user_id: str,
        session_id: str
    ):
        """고지 표시 기록"""
        await self.storage.save({
            "user_id": user_id,
            "session_id": session_id,
            "shown_at": datetime.utcnow(),
            "disclosure_version": self.current_version
        })
```

### 3.2 결정 설명 가능성

```python
# agentops/compliance/explainability.py

@dataclass
class DecisionExplanation:
    """의사 결정 설명"""
    decision: str
    confidence: float
    reasoning_steps: List[str]
    factors_considered: List[Dict[str, Any]]
    limitations: List[str]
    human_review_recommended: bool

class ExplainableAgent:
    """설명 가능한 에이전트 래퍼"""

    async def make_decision_with_explanation(
        self,
        input_data: Dict,
        context: Dict
    ) -> tuple[Any, DecisionExplanation]:
        """설명과 함께 결정"""

        # 추론 과정 기록
        reasoning_trace = []

        with self.tracer.start_span("decision_making") as span:
            # 1. 정보 수집
            reasoning_trace.append("입력 데이터 분석 중...")
            factors = await self._gather_factors(input_data)

            # 2. 분석
            reasoning_trace.append(f"{len(factors)}개 요소 고려 중...")
            analysis = await self._analyze(factors, context)

            # 3. 결정
            decision = await self._decide(analysis)
            reasoning_trace.append(f"결정: {decision}")

        explanation = DecisionExplanation(
            decision=decision,
            confidence=analysis.confidence,
            reasoning_steps=reasoning_trace,
            factors_considered=factors,
            limitations=self._get_limitations(),
            human_review_recommended=analysis.confidence < 0.8
        )

        return decision, explanation
```

---

## 4. 감사 추적

### 4.1 감사 로그 스키마

```python
# agentops/compliance/audit.py

@dataclass
class AuditLog:
    """감사 로그"""
    log_id: str
    timestamp: datetime
    event_type: str
    actor: str  # user_id or system
    action: str
    resource_type: str
    resource_id: str
    old_value: Optional[Dict] = None
    new_value: Optional[Dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    result: str = "success"  # success, failure
    metadata: Dict = field(default_factory=dict)

class AuditLogger:
    """감사 로거"""

    REQUIRED_EVENTS = [
        "user.login",
        "user.logout",
        "data.access",
        "data.export",
        "data.delete",
        "config.change",
        "permission.change",
        "agent.invoke",
        "guardrail.trigger"
    ]

    async def log(
        self,
        event_type: str,
        action: str,
        resource_type: str,
        resource_id: str,
        **kwargs
    ):
        """감사 이벤트 기록"""
        log = AuditLog(
            log_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            event_type=event_type,
            actor=self._get_current_actor(),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            **kwargs
        )

        # 변조 방지 저장
        await self._immutable_store(log)

        # 실시간 모니터링 전송
        await self._send_to_siem(log)
```

---

## 5. 컴플라이언스 대시보드

```yaml
# grafana-compliance-dashboard.yaml

panels:
  - title: "Data Subject Requests"
    type: stat
    targets:
      - expr: sum(increase(dsr_requests_total[30d])) by (type)

  - title: "Consent Status"
    type: piechart
    targets:
      - expr: sum(user_consents) by (status)

  - title: "Guardrail Violations"
    type: timeseries
    targets:
      - expr: sum(rate(guardrail_violations_total[1h])) by (type)

  - title: "Data Retention Compliance"
    type: gauge
    targets:
      - expr: |
          (sum(data_within_retention_period) / sum(total_data_records)) * 100
```

---

## 6. 다음 단계

- [감사 로깅](./audit) - 상세 감사 시스템
- [Guardrails](./guardrails) - 안전 가드레일
- [프로덕션 체크리스트](../best-practices/production-checklist) - 컴플라이언스 검증
