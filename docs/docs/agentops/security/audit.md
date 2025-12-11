---
sidebar_position: 3
title: "감사 로깅"
description: "AI 에이전트 감사 추적 시스템 구현"
---

# 감사 로깅 구현 가이드

AI 에이전트의 모든 활동을 추적하고 감사 가능한 로그를 생성하는 시스템을 구축합니다.

---

## 1. 감사 요구사항

### 1.1 감사 대상 이벤트

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Auditable Events                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  사용자 활동                 에이전트 활동              시스템 활동       │
│  ─────────────              ──────────────            ──────────        │
│  • 로그인/로그아웃          • 요청 처리                • 설정 변경       │
│  • 세션 시작/종료           • LLM 호출                 • 배포            │
│  • 데이터 조회              • 도구 사용                • 스케일링        │
│  • 데이터 수정              • 결정 내림                • 장애            │
│  • 데이터 삭제              • 가드레일 트리거          • 복구            │
│  • 데이터 내보내기          • 에이전트 간 통신         • 백업            │
│  • 권한 변경                • 메모리 접근              • 인증서 갱신     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 감사 로그 구현

### 2.1 로그 스키마

```python
# agentops/audit/schema.py

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum
import hashlib
import json

class AuditEventType(str, Enum):
    # 사용자
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_SESSION_START = "user.session_start"
    USER_SESSION_END = "user.session_end"

    # 데이터
    DATA_ACCESS = "data.access"
    DATA_CREATE = "data.create"
    DATA_UPDATE = "data.update"
    DATA_DELETE = "data.delete"
    DATA_EXPORT = "data.export"

    # 에이전트
    AGENT_REQUEST = "agent.request"
    AGENT_RESPONSE = "agent.response"
    AGENT_LLM_CALL = "agent.llm_call"
    AGENT_TOOL_CALL = "agent.tool_call"
    AGENT_DECISION = "agent.decision"
    AGENT_DELEGATION = "agent.delegation"

    # 보안
    GUARDRAIL_TRIGGER = "security.guardrail"
    AUTH_FAILURE = "security.auth_failure"
    PERMISSION_DENIED = "security.permission_denied"
    SUSPICIOUS_ACTIVITY = "security.suspicious"

    # 시스템
    CONFIG_CHANGE = "system.config_change"
    DEPLOYMENT = "system.deployment"
    ERROR = "system.error"

class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class AuditEntry:
    """감사 로그 엔트리"""

    # 식별자
    entry_id: str
    timestamp: datetime

    # 이벤트 정보
    event_type: AuditEventType
    severity: AuditSeverity
    action: str
    description: str

    # 주체 (누가)
    actor_type: str  # user, system, agent
    actor_id: str
    actor_name: Optional[str] = None

    # 대상 (무엇을)
    resource_type: str
    resource_id: str
    resource_name: Optional[str] = None

    # 컨텍스트
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    trace_id: Optional[str] = None
    agent_id: Optional[str] = None

    # 변경 내용
    old_value: Optional[Dict] = None
    new_value: Optional[Dict] = None

    # 결과
    result: str = "success"  # success, failure, partial
    error_message: Optional[str] = None

    # 클라이언트 정보
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    geo_location: Optional[str] = None

    # 메타데이터
    metadata: Dict[str, Any] = field(default_factory=dict)

    # 무결성
    checksum: Optional[str] = None
    previous_checksum: Optional[str] = None

    def calculate_checksum(self, previous_checksum: str = None) -> str:
        """체인 해시 계산"""
        data = {
            "entry_id": self.entry_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "actor_id": self.actor_id,
            "resource_id": self.resource_id,
            "result": self.result,
            "previous_checksum": previous_checksum or ""
        }
        content = json.dumps(data, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "severity": self.severity.value,
            "action": self.action,
            "description": self.description,
            "actor": {
                "type": self.actor_type,
                "id": self.actor_id,
                "name": self.actor_name
            },
            "resource": {
                "type": self.resource_type,
                "id": self.resource_id,
                "name": self.resource_name
            },
            "context": {
                "session_id": self.session_id,
                "request_id": self.request_id,
                "trace_id": self.trace_id,
                "agent_id": self.agent_id
            },
            "changes": {
                "old_value": self.old_value,
                "new_value": self.new_value
            },
            "result": self.result,
            "error_message": self.error_message,
            "client": {
                "ip_address": self.ip_address,
                "user_agent": self.user_agent,
                "geo_location": self.geo_location
            },
            "metadata": self.metadata,
            "integrity": {
                "checksum": self.checksum,
                "previous_checksum": self.previous_checksum
            }
        }
```

### 2.2 감사 로거

```python
# agentops/audit/logger.py

class AuditLogger:
    """
    감사 로거
    변조 방지 감사 로그 생성
    """

    def __init__(
        self,
        storage: AuditStorage,
        siem_client: Optional[SIEMClient] = None,
        encryption_key: Optional[str] = None
    ):
        self.storage = storage
        self.siem = siem_client
        self.encryption_key = encryption_key
        self._last_checksum: Optional[str] = None
        self._lock = asyncio.Lock()

    async def log(
        self,
        event_type: AuditEventType,
        action: str,
        resource_type: str,
        resource_id: str,
        description: str = "",
        severity: AuditSeverity = AuditSeverity.INFO,
        **kwargs
    ) -> AuditEntry:
        """감사 이벤트 기록"""

        async with self._lock:
            # 엔트리 생성
            entry = AuditEntry(
                entry_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                event_type=event_type,
                severity=severity,
                action=action,
                description=description,
                actor_type=self._get_actor_type(),
                actor_id=self._get_actor_id(),
                actor_name=self._get_actor_name(),
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=self._get_client_ip(),
                user_agent=self._get_user_agent(),
                **kwargs
            )

            # 체인 해시 계산
            entry.previous_checksum = self._last_checksum
            entry.checksum = entry.calculate_checksum(self._last_checksum)
            self._last_checksum = entry.checksum

            # 민감 정보 암호화
            if self.encryption_key:
                entry = self._encrypt_sensitive_fields(entry)

            # 저장
            await self.storage.save(entry)

            # SIEM 전송
            if self.siem and severity in [AuditSeverity.WARNING, AuditSeverity.ERROR, AuditSeverity.CRITICAL]:
                await self.siem.send(entry)

            return entry

    # 편의 메서드들
    async def log_user_login(self, user_id: str, success: bool, **kwargs):
        await self.log(
            event_type=AuditEventType.USER_LOGIN,
            action="login",
            resource_type="user",
            resource_id=user_id,
            description=f"User login {'successful' if success else 'failed'}",
            severity=AuditSeverity.INFO if success else AuditSeverity.WARNING,
            result="success" if success else "failure",
            **kwargs
        )

    async def log_agent_request(
        self,
        agent_id: str,
        request_id: str,
        action: str,
        input_summary: str,
        **kwargs
    ):
        await self.log(
            event_type=AuditEventType.AGENT_REQUEST,
            action=action,
            resource_type="agent",
            resource_id=agent_id,
            description=f"Agent request: {action}",
            request_id=request_id,
            metadata={"input_summary": input_summary[:500]},
            **kwargs
        )

    async def log_guardrail_trigger(
        self,
        guardrail_type: str,
        direction: str,
        action_taken: str,
        reason: str,
        **kwargs
    ):
        await self.log(
            event_type=AuditEventType.GUARDRAIL_TRIGGER,
            action=action_taken,
            resource_type="guardrail",
            resource_id=guardrail_type,
            description=f"Guardrail {guardrail_type} triggered: {reason}",
            severity=AuditSeverity.WARNING,
            metadata={
                "guardrail_type": guardrail_type,
                "direction": direction,
                "reason": reason
            },
            **kwargs
        )

    async def log_data_access(
        self,
        data_type: str,
        data_id: str,
        access_type: str,
        purpose: str,
        **kwargs
    ):
        await self.log(
            event_type=AuditEventType.DATA_ACCESS,
            action=access_type,
            resource_type=data_type,
            resource_id=data_id,
            description=f"Data {access_type}: {purpose}",
            metadata={"purpose": purpose},
            **kwargs
        )
```

---

## 3. 감사 로그 저장

### 3.1 불변 저장소

```python
# agentops/audit/storage.py

class ImmutableAuditStorage:
    """
    불변 감사 로그 저장소
    Write-Once, Read-Many (WORM)
    """

    def __init__(
        self,
        primary_storage: StorageBackend,  # ClickHouse
        backup_storage: StorageBackend,   # S3 Glacier
        retention_days: int = 2555  # 7년
    ):
        self.primary = primary_storage
        self.backup = backup_storage
        self.retention_days = retention_days

    async def save(self, entry: AuditEntry):
        """감사 로그 저장 (불변)"""

        # 1. Primary 저장
        await self.primary.insert(entry)

        # 2. Backup 저장 (비동기)
        asyncio.create_task(self.backup.archive(entry))

        # 3. 무결성 검증
        await self._verify_chain_integrity(entry)

    async def _verify_chain_integrity(self, entry: AuditEntry):
        """체인 무결성 검증"""
        if entry.previous_checksum:
            previous = await self.primary.get_by_checksum(entry.previous_checksum)
            if not previous:
                raise IntegrityError("Chain broken: previous entry not found")

    async def query(
        self,
        start_time: datetime,
        end_time: datetime,
        filters: Dict = None,
        limit: int = 1000
    ) -> List[AuditEntry]:
        """감사 로그 조회"""
        return await self.primary.query(
            start_time=start_time,
            end_time=end_time,
            filters=filters,
            limit=limit
        )

    async def verify_integrity(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> IntegrityReport:
        """구간 무결성 검증"""
        entries = await self.query(start_time, end_time, limit=10000)

        errors = []
        for i, entry in enumerate(entries[1:], 1):
            expected_checksum = entries[i-1].checksum
            if entry.previous_checksum != expected_checksum:
                errors.append({
                    "entry_id": entry.entry_id,
                    "expected": expected_checksum,
                    "actual": entry.previous_checksum
                })

        return IntegrityReport(
            start_time=start_time,
            end_time=end_time,
            total_entries=len(entries),
            verified_ok=len(errors) == 0,
            errors=errors
        )
```

---

## 4. 감사 보고서

### 4.1 보고서 생성

```python
# agentops/audit/reports.py

class AuditReportGenerator:
    """감사 보고서 생성기"""

    async def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime,
        report_type: str = "monthly"
    ) -> ComplianceReport:
        """컴플라이언스 보고서 생성"""

        # 데이터 수집
        entries = await self.storage.query(start_date, end_date)

        report = {
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "total_events": len(entries),
                "by_type": self._count_by_type(entries),
                "by_severity": self._count_by_severity(entries)
            },
            "data_access": {
                "total_accesses": self._count_data_access(entries),
                "by_purpose": self._group_by_purpose(entries),
                "unique_users": self._count_unique_actors(entries)
            },
            "security_events": {
                "guardrail_triggers": self._count_guardrails(entries),
                "auth_failures": self._count_auth_failures(entries),
                "suspicious_activities": self._count_suspicious(entries)
            },
            "agent_activity": {
                "total_requests": self._count_agent_requests(entries),
                "llm_calls": self._count_llm_calls(entries),
                "tool_usage": self._count_tool_usage(entries)
            },
            "integrity": await self.storage.verify_integrity(start_date, end_date)
        }

        return ComplianceReport(**report)
```

---

## 5. 다음 단계

- [Guardrails](./guardrails) - 보안 가드레일
- [컴플라이언스](./compliance) - 규정 준수
- [프로덕션 체크리스트](../best-practices/production-checklist) - 감사 준비
