---
sidebar_position: 2
title: "Control Plane"
description: "AgentOps Control Plane의 상세 설계 및 구현"
---

# Control Plane 설계

Control Plane은 AgentOps 플랫폼의 **두뇌** 역할을 합니다. 에이전트의 등록, 설정, 정책, 보안을 중앙에서 관리합니다.

---

## 1. Control Plane 개요

### 1.1 책임 영역

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Control Plane Responsibilities                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Agent Lifecycle │  │  Configuration  │  │    Security     │         │
│  │    Management    │  │   Management    │  │   & Policy      │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Registration   │  │ • Dynamic config│  │ • RBAC          │         │
│  │ • Versioning     │  │ • Feature flags │  │ • Secrets mgmt  │         │
│  │ • Discovery      │  │ • Environment   │  │ • Policy engine │         │
│  │ • Health mgmt    │  │ • Hot reload    │  │ • Audit logging │         │
│  │ • Deprecation    │  │ • Rollback      │  │ • Compliance    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    Workflow     │  │   Rate Limiting │  │   Integration   │         │
│  │   Orchestration │  │    & Quotas     │  │    Gateway      │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Approval flows│  │ • Token budgets │  │ • Webhook mgmt  │         │
│  │ • Human-in-loop │  │ • API rate limit│  │ • Event routing │         │
│  │ • Escalations   │  │ • Cost controls │  │ • Schema mgmt   │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 컴포넌트

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Control Plane Architecture                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                        ┌─────────────────┐                              │
│                        │   API Gateway   │                              │
│                        │  (Kong/Envoy)   │                              │
│                        └────────┬────────┘                              │
│                                 │                                        │
│         ┌───────────────────────┼───────────────────────┐               │
│         │                       │                       │               │
│         ▼                       ▼                       ▼               │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐         │
│  │   Agent     │        │   Config    │        │   Policy    │         │
│  │  Registry   │        │   Server    │        │   Engine    │         │
│  │   Service   │        │   Service   │        │   Service   │         │
│  └──────┬──────┘        └──────┬──────┘        └──────┬──────┘         │
│         │                      │                      │                 │
│         └──────────────────────┼──────────────────────┘                 │
│                                │                                        │
│                                ▼                                        │
│                     ┌─────────────────────┐                            │
│                     │   Secrets Vault     │                            │
│                     │   (HashiCorp/AWS)   │                            │
│                     └─────────────────────┘                            │
│                                │                                        │
│         ┌──────────────────────┼──────────────────────┐                │
│         │                      │                      │                │
│         ▼                      ▼                      ▼                │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐          │
│  │  PostgreSQL │       │    Redis    │       │    etcd     │          │
│  │  (Primary)  │       │   (Cache)   │       │  (Leader)   │          │
│  └─────────────┘       └─────────────┘       └─────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent Registry Service

### 2.1 데이터 모델

```python
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum
import uuid

class AgentStatus(Enum):
    PENDING = "pending"           # 등록 대기
    ACTIVE = "active"             # 정상 운영
    DEPRECATED = "deprecated"     # 사용 중단 예정
    DISABLED = "disabled"         # 비활성화
    FAILED = "failed"             # 장애 상태

class CapabilityType(Enum):
    REASONING = "reasoning"
    TOOL_USE = "tool_use"
    MEMORY = "memory"
    PLANNING = "planning"
    CODING = "coding"
    ANALYSIS = "analysis"

@dataclass
class AgentCapability:
    """에이전트 기능 정의"""
    type: CapabilityType
    name: str
    description: str
    input_schema: Dict
    output_schema: Dict
    version: str = "1.0.0"

@dataclass
class AgentCard:
    """
    A2A 프로토콜 호환 에이전트 카드
    에이전트의 메타데이터와 기능을 정의
    """
    # 기본 식별 정보
    agent_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    version: str = "1.0.0"
    description: str = ""

    # 기능 정의
    capabilities: List[AgentCapability] = field(default_factory=list)
    supported_protocols: List[str] = field(default_factory=lambda: ["a2a/1.0", "http/1.1"])

    # 스키마 정의
    input_schema: Dict = field(default_factory=dict)
    output_schema: Dict = field(default_factory=dict)

    # 의존성
    dependencies: List[str] = field(default_factory=list)
    required_tools: List[str] = field(default_factory=list)
    required_models: List[str] = field(default_factory=list)

    # 운영 정보
    health_endpoint: str = "/health"
    metrics_endpoint: str = "/metrics"
    min_instances: int = 1
    max_instances: int = 10

    # 리소스 요구사항
    resource_requirements: Dict = field(default_factory=lambda: {
        "cpu": "500m",
        "memory": "512Mi",
        "gpu": None
    })

    # 메타데이터
    owner: str = ""
    team: str = ""
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class AgentVersion:
    """에이전트 버전 정보"""
    version: str
    card: AgentCard
    image_tag: str
    changelog: str
    created_at: datetime
    created_by: str
    status: AgentStatus = AgentStatus.PENDING
    rollout_percentage: float = 0.0  # 카나리 배포용

@dataclass
class AgentRecord:
    """레지스트리에 저장되는 에이전트 레코드"""
    agent_id: str
    current_version: str
    versions: List[AgentVersion]
    status: AgentStatus
    endpoint: str
    health_status: Dict
    last_health_check: datetime
    metrics: Dict
```

### 2.2 Registry Service 구현

```python
from typing import List, Optional
import asyncio
from datetime import datetime, timedelta

class AgentRegistryService:
    """
    에이전트 레지스트리 서비스
    에이전트의 전체 생명주기를 관리
    """

    def __init__(
        self,
        storage: RegistryStorage,
        policy_engine: PolicyEngine,
        event_bus: EventBus,
        cache: CacheService
    ):
        self.storage = storage
        self.policy_engine = policy_engine
        self.event_bus = event_bus
        self.cache = cache
        self._health_check_interval = 30  # seconds

    # ==================== Registration ====================

    async def register_agent(
        self,
        card: AgentCard,
        requester: AuthContext
    ) -> RegistrationResult:
        """
        새 에이전트 등록
        """
        # 1. 권한 확인
        if not await self._check_permission(requester, "agent:register"):
            return RegistrationResult(
                success=False,
                error="Permission denied"
            )

        # 2. 카드 검증
        validation = await self._validate_card(card)
        if not validation.valid:
            return RegistrationResult(
                success=False,
                error=validation.errors
            )

        # 3. 중복 확인
        existing = await self.storage.find_by_name(card.name)
        if existing:
            return RegistrationResult(
                success=False,
                error=f"Agent '{card.name}' already exists"
            )

        # 4. 의존성 확인
        deps_check = await self._verify_dependencies(card.dependencies)
        if not deps_check.satisfied:
            return RegistrationResult(
                success=False,
                error=f"Unsatisfied dependencies: {deps_check.missing}"
            )

        # 5. 정책 평가
        policy_decision = await self.policy_engine.evaluate(
            PolicyRequest(
                action="register_agent",
                resource=card.dict(),
                context={"requester": requester.user_id}
            )
        )
        if not policy_decision.allow:
            return RegistrationResult(
                success=False,
                error=f"Policy violation: {policy_decision.reason}"
            )

        # 6. 저장
        version = AgentVersion(
            version=card.version,
            card=card,
            image_tag=f"{card.name}:{card.version}",
            changelog="Initial registration",
            created_at=datetime.utcnow(),
            created_by=requester.user_id,
            status=AgentStatus.PENDING
        )

        record = AgentRecord(
            agent_id=card.agent_id,
            current_version=card.version,
            versions=[version],
            status=AgentStatus.PENDING,
            endpoint="",
            health_status={},
            last_health_check=datetime.utcnow(),
            metrics={}
        )

        await self.storage.save(record)

        # 7. 캐시 무효화
        await self.cache.invalidate(f"agent:{card.agent_id}")
        await self.cache.invalidate("agent:list")

        # 8. 이벤트 발행
        await self.event_bus.publish(
            "agent.registered",
            {
                "agent_id": card.agent_id,
                "name": card.name,
                "version": card.version,
                "requester": requester.user_id
            }
        )

        return RegistrationResult(
            success=True,
            agent_id=card.agent_id,
            message="Agent registered successfully. Awaiting deployment."
        )

    # ==================== Version Management ====================

    async def publish_version(
        self,
        agent_id: str,
        new_card: AgentCard,
        changelog: str,
        requester: AuthContext
    ) -> VersionResult:
        """
        새 버전 발행
        """
        record = await self.storage.get(agent_id)
        if not record:
            return VersionResult(success=False, error="Agent not found")

        # 버전 유효성 검사
        if new_card.version <= record.current_version:
            return VersionResult(
                success=False,
                error=f"Version must be greater than current: {record.current_version}"
            )

        new_version = AgentVersion(
            version=new_card.version,
            card=new_card,
            image_tag=f"{new_card.name}:{new_card.version}",
            changelog=changelog,
            created_at=datetime.utcnow(),
            created_by=requester.user_id,
            status=AgentStatus.PENDING
        )

        record.versions.append(new_version)
        await self.storage.update(record)

        await self.event_bus.publish(
            "agent.version_published",
            {
                "agent_id": agent_id,
                "version": new_card.version,
                "previous_version": record.current_version
            }
        )

        return VersionResult(
            success=True,
            version=new_card.version
        )

    async def rollout_version(
        self,
        agent_id: str,
        version: str,
        percentage: float,
        requester: AuthContext
    ) -> RolloutResult:
        """
        버전 점진적 배포 (카나리)
        """
        record = await self.storage.get(agent_id)
        version_record = next(
            (v for v in record.versions if v.version == version),
            None
        )

        if not version_record:
            return RolloutResult(success=False, error="Version not found")

        version_record.rollout_percentage = percentage

        if percentage >= 100:
            version_record.status = AgentStatus.ACTIVE
            record.current_version = version

        await self.storage.update(record)

        await self.event_bus.publish(
            "agent.rollout_updated",
            {
                "agent_id": agent_id,
                "version": version,
                "percentage": percentage
            }
        )

        return RolloutResult(
            success=True,
            percentage=percentage
        )

    # ==================== Discovery ====================

    async def discover_agents(
        self,
        capabilities: List[str] = None,
        tags: List[str] = None,
        status: AgentStatus = AgentStatus.ACTIVE
    ) -> List[AgentCard]:
        """
        에이전트 검색
        A2A 프로토콜 discovery 지원
        """
        cache_key = f"discover:{capabilities}:{tags}:{status}"

        # 캐시 확인
        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        # 검색 실행
        query = DiscoveryQuery(
            capabilities=capabilities,
            tags=tags,
            status=status
        )

        records = await self.storage.search(query)

        # 현재 활성 버전의 카드만 반환
        cards = [
            self._get_active_card(record)
            for record in records
        ]

        # 캐시 저장 (5분)
        await self.cache.set(cache_key, cards, ttl=300)

        return cards

    # ==================== Health Management ====================

    async def update_health_status(
        self,
        agent_id: str,
        status: HealthStatus
    ):
        """
        에이전트 헬스 상태 업데이트
        """
        record = await self.storage.get(agent_id)
        if not record:
            return

        record.health_status = status.dict()
        record.last_health_check = datetime.utcnow()

        # 상태 변경 감지
        if status.healthy and record.status == AgentStatus.FAILED:
            record.status = AgentStatus.ACTIVE
            await self.event_bus.publish(
                "agent.recovered",
                {"agent_id": agent_id}
            )
        elif not status.healthy and record.status == AgentStatus.ACTIVE:
            record.status = AgentStatus.FAILED
            await self.event_bus.publish(
                "agent.failed",
                {
                    "agent_id": agent_id,
                    "reason": status.error
                }
            )

        await self.storage.update(record)

    async def run_health_checks(self):
        """
        주기적 헬스 체크 실행
        """
        while True:
            try:
                agents = await self.storage.list_active()

                tasks = [
                    self._check_agent_health(agent)
                    for agent in agents
                ]

                await asyncio.gather(*tasks, return_exceptions=True)

            except Exception as e:
                logger.error(f"Health check cycle failed: {e}")

            await asyncio.sleep(self._health_check_interval)

    async def _check_agent_health(self, record: AgentRecord):
        """개별 에이전트 헬스 체크"""
        try:
            async with aiohttp.ClientSession() as session:
                card = self._get_active_card(record)
                url = f"{record.endpoint}{card.health_endpoint}"

                async with session.get(url, timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        await self.update_health_status(
                            record.agent_id,
                            HealthStatus(healthy=True, details=data)
                        )
                    else:
                        await self.update_health_status(
                            record.agent_id,
                            HealthStatus(
                                healthy=False,
                                error=f"HTTP {response.status}"
                            )
                        )
        except asyncio.TimeoutError:
            await self.update_health_status(
                record.agent_id,
                HealthStatus(healthy=False, error="Health check timeout")
            )
        except Exception as e:
            await self.update_health_status(
                record.agent_id,
                HealthStatus(healthy=False, error=str(e))
            )
```

---

## 3. Config Server Service

### 3.1 설정 모델

```python
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class ConfigScope(Enum):
    GLOBAL = "global"           # 전역 설정
    ENVIRONMENT = "environment" # 환경별 (dev, staging, prod)
    AGENT = "agent"             # 에이전트별
    VERSION = "version"         # 버전별

class ConfigFormat(Enum):
    JSON = "json"
    YAML = "yaml"
    PROPERTIES = "properties"

@dataclass
class ConfigEntry:
    """설정 항목"""
    key: str
    value: Any
    scope: ConfigScope
    scope_id: str  # environment name, agent_id, etc.
    version: int
    created_at: datetime
    created_by: str
    encrypted: bool = False
    sensitive: bool = False
    description: str = ""

@dataclass
class ConfigSnapshot:
    """특정 시점의 설정 스냅샷"""
    snapshot_id: str
    scope: ConfigScope
    scope_id: str
    entries: Dict[str, ConfigEntry]
    created_at: datetime
    created_by: str
    description: str

@dataclass
class ConfigChangeEvent:
    """설정 변경 이벤트"""
    event_id: str
    key: str
    old_value: Any
    new_value: Any
    scope: ConfigScope
    scope_id: str
    changed_by: str
    changed_at: datetime
    reason: str
```

### 3.2 Config Server 구현

```python
class ConfigServerService:
    """
    동적 설정 관리 서비스
    실시간 설정 변경 및 배포 지원
    """

    def __init__(
        self,
        storage: ConfigStorage,
        cache: CacheService,
        event_bus: EventBus,
        encryption: EncryptionService
    ):
        self.storage = storage
        self.cache = cache
        self.event_bus = event_bus
        self.encryption = encryption
        self._subscribers: Dict[str, List[Callable]] = {}

    # ==================== CRUD Operations ====================

    async def set_config(
        self,
        key: str,
        value: Any,
        scope: ConfigScope,
        scope_id: str,
        requester: AuthContext,
        encrypted: bool = False,
        description: str = ""
    ) -> ConfigResult:
        """
        설정 값 저장/업데이트
        """
        # 권한 확인
        if not await self._check_permission(requester, scope, "write"):
            return ConfigResult(success=False, error="Permission denied")

        # 기존 값 조회
        existing = await self.storage.get(key, scope, scope_id)
        old_value = existing.value if existing else None

        # 암호화 처리
        stored_value = value
        if encrypted:
            stored_value = await self.encryption.encrypt(
                json.dumps(value)
            )

        # 버전 증가
        new_version = (existing.version + 1) if existing else 1

        entry = ConfigEntry(
            key=key,
            value=stored_value,
            scope=scope,
            scope_id=scope_id,
            version=new_version,
            created_at=datetime.utcnow(),
            created_by=requester.user_id,
            encrypted=encrypted,
            description=description
        )

        await self.storage.save(entry)

        # 캐시 업데이트
        cache_key = self._make_cache_key(key, scope, scope_id)
        await self.cache.delete(cache_key)

        # 변경 이벤트 발행
        change_event = ConfigChangeEvent(
            event_id=str(uuid.uuid4()),
            key=key,
            old_value=old_value,
            new_value=value,
            scope=scope,
            scope_id=scope_id,
            changed_by=requester.user_id,
            changed_at=datetime.utcnow(),
            reason=description
        )

        await self.event_bus.publish(
            "config.changed",
            change_event.dict()
        )

        # 구독자 알림
        await self._notify_subscribers(key, scope, scope_id, value)

        return ConfigResult(
            success=True,
            version=new_version
        )

    async def get_config(
        self,
        key: str,
        scope: ConfigScope,
        scope_id: str,
        default: Any = None
    ) -> Any:
        """
        설정 값 조회 (캐시 우선)
        """
        cache_key = self._make_cache_key(key, scope, scope_id)

        # 캐시 확인
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        # 스토리지에서 조회
        entry = await self.storage.get(key, scope, scope_id)

        if entry is None:
            # 상위 스코프에서 fallback
            value = await self._fallback_lookup(key, scope, scope_id)
            if value is not None:
                return value
            return default

        # 복호화 처리
        value = entry.value
        if entry.encrypted:
            decrypted = await self.encryption.decrypt(entry.value)
            value = json.loads(decrypted)

        # 캐시 저장
        await self.cache.set(cache_key, value, ttl=300)

        return value

    async def get_all_configs(
        self,
        scope: ConfigScope,
        scope_id: str
    ) -> Dict[str, Any]:
        """
        스코프의 모든 설정 조회
        계층적 병합 수행
        """
        # 전역 설정
        global_configs = await self.storage.list_by_scope(
            ConfigScope.GLOBAL, "global"
        )

        # 환경별 설정 (있는 경우)
        env_configs = {}
        if scope in [ConfigScope.ENVIRONMENT, ConfigScope.AGENT, ConfigScope.VERSION]:
            env = await self._get_environment(scope, scope_id)
            env_configs = await self.storage.list_by_scope(
                ConfigScope.ENVIRONMENT, env
            )

        # 에이전트별 설정 (있는 경우)
        agent_configs = {}
        if scope in [ConfigScope.AGENT, ConfigScope.VERSION]:
            agent_id = await self._get_agent_id(scope, scope_id)
            agent_configs = await self.storage.list_by_scope(
                ConfigScope.AGENT, agent_id
            )

        # 버전별 설정 (있는 경우)
        version_configs = {}
        if scope == ConfigScope.VERSION:
            version_configs = await self.storage.list_by_scope(
                ConfigScope.VERSION, scope_id
            )

        # 계층적 병합 (하위 스코프가 상위를 오버라이드)
        merged = {**global_configs, **env_configs, **agent_configs, **version_configs}

        return merged

    # ==================== Feature Flags ====================

    async def set_feature_flag(
        self,
        flag_name: str,
        enabled: bool,
        conditions: Dict = None,
        rollout_percentage: float = 100.0,
        requester: AuthContext
    ) -> ConfigResult:
        """
        기능 플래그 설정
        조건부 활성화 및 점진적 롤아웃 지원
        """
        flag_config = {
            "enabled": enabled,
            "conditions": conditions or {},
            "rollout_percentage": rollout_percentage,
            "updated_at": datetime.utcnow().isoformat()
        }

        return await self.set_config(
            key=f"feature_flag:{flag_name}",
            value=flag_config,
            scope=ConfigScope.GLOBAL,
            scope_id="global",
            requester=requester,
            description=f"Feature flag: {flag_name}"
        )

    async def is_feature_enabled(
        self,
        flag_name: str,
        context: Dict = None
    ) -> bool:
        """
        기능 플래그 평가
        """
        flag_config = await self.get_config(
            key=f"feature_flag:{flag_name}",
            scope=ConfigScope.GLOBAL,
            scope_id="global",
            default={"enabled": False}
        )

        if not flag_config.get("enabled"):
            return False

        # 조건 평가
        conditions = flag_config.get("conditions", {})
        if conditions and context:
            if not self._evaluate_conditions(conditions, context):
                return False

        # 롤아웃 비율 평가
        rollout = flag_config.get("rollout_percentage", 100.0)
        if rollout < 100.0:
            user_bucket = self._calculate_bucket(context.get("user_id", ""))
            if user_bucket > rollout:
                return False

        return True

    def _evaluate_conditions(
        self,
        conditions: Dict,
        context: Dict
    ) -> bool:
        """조건 평가 (간단한 규칙 엔진)"""
        for key, expected in conditions.items():
            actual = context.get(key)
            if isinstance(expected, list):
                if actual not in expected:
                    return False
            elif actual != expected:
                return False
        return True

    def _calculate_bucket(self, user_id: str) -> float:
        """사용자를 0-100 버킷에 할당"""
        hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
        return (hash_val % 100)

    # ==================== Snapshots & Rollback ====================

    async def create_snapshot(
        self,
        scope: ConfigScope,
        scope_id: str,
        description: str,
        requester: AuthContext
    ) -> SnapshotResult:
        """
        현재 설정의 스냅샷 생성
        """
        entries = await self.storage.list_by_scope(scope, scope_id)

        snapshot = ConfigSnapshot(
            snapshot_id=str(uuid.uuid4()),
            scope=scope,
            scope_id=scope_id,
            entries=entries,
            created_at=datetime.utcnow(),
            created_by=requester.user_id,
            description=description
        )

        await self.storage.save_snapshot(snapshot)

        return SnapshotResult(
            success=True,
            snapshot_id=snapshot.snapshot_id
        )

    async def rollback_to_snapshot(
        self,
        snapshot_id: str,
        requester: AuthContext
    ) -> RollbackResult:
        """
        스냅샷으로 롤백
        """
        snapshot = await self.storage.get_snapshot(snapshot_id)
        if not snapshot:
            return RollbackResult(success=False, error="Snapshot not found")

        # 현재 설정 백업
        await self.create_snapshot(
            snapshot.scope,
            snapshot.scope_id,
            f"Auto backup before rollback to {snapshot_id}",
            requester
        )

        # 스냅샷 설정 복원
        for key, entry in snapshot.entries.items():
            await self.storage.save(entry)

        # 캐시 무효화
        await self.cache.invalidate_pattern(
            f"config:{snapshot.scope.value}:{snapshot.scope_id}:*"
        )

        await self.event_bus.publish(
            "config.rollback",
            {
                "snapshot_id": snapshot_id,
                "scope": snapshot.scope.value,
                "scope_id": snapshot.scope_id,
                "rolled_back_by": requester.user_id
            }
        )

        return RollbackResult(
            success=True,
            message=f"Rolled back to snapshot {snapshot_id}"
        )

    # ==================== Live Reload ====================

    async def subscribe(
        self,
        key_pattern: str,
        callback: Callable
    ) -> str:
        """
        설정 변경 구독
        실시간 설정 리로드용
        """
        subscription_id = str(uuid.uuid4())

        if key_pattern not in self._subscribers:
            self._subscribers[key_pattern] = []

        self._subscribers[key_pattern].append({
            "id": subscription_id,
            "callback": callback
        })

        return subscription_id

    async def _notify_subscribers(
        self,
        key: str,
        scope: ConfigScope,
        scope_id: str,
        new_value: Any
    ):
        """설정 변경 시 구독자에게 알림"""
        for pattern, subscribers in self._subscribers.items():
            if fnmatch.fnmatch(key, pattern):
                for sub in subscribers:
                    try:
                        await sub["callback"](key, new_value, scope, scope_id)
                    except Exception as e:
                        logger.error(f"Subscriber callback error: {e}")
```

---

## 4. Policy Engine Service

### 4.1 정책 모델

```python
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from enum import Enum

class PolicyEffect(Enum):
    ALLOW = "allow"
    DENY = "deny"

class PolicyConditionOperator(Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    STARTS_WITH = "starts_with"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    REGEX = "regex"

@dataclass
class PolicyCondition:
    """정책 조건"""
    field: str  # 평가할 필드 (예: "context.user.role")
    operator: PolicyConditionOperator
    value: Any

@dataclass
class PolicyRule:
    """정책 규칙"""
    rule_id: str
    name: str
    description: str
    effect: PolicyEffect
    actions: List[str]  # 와일드카드 지원 (예: "agent:*", "config:read")
    resources: List[str]  # 와일드카드 지원 (예: "agent:travel-*")
    conditions: List[PolicyCondition]
    priority: int = 0  # 높을수록 우선

@dataclass
class Policy:
    """정책"""
    policy_id: str
    name: str
    description: str
    version: str
    rules: List[PolicyRule]
    attached_to: List[str]  # 적용 대상 (roles, users, agents)
    enabled: bool = True
    created_at: datetime = None
    updated_at: datetime = None

@dataclass
class PolicyRequest:
    """정책 평가 요청"""
    action: str  # 수행하려는 작업
    resource: str  # 대상 리소스
    context: Dict  # 추가 컨텍스트 (사용자, 환경 등)

@dataclass
class PolicyDecision:
    """정책 평가 결과"""
    allow: bool
    reason: str
    matched_rules: List[str]
    evaluated_at: datetime
```

### 4.2 Policy Engine 구현

```python
class PolicyEngineService:
    """
    정책 엔진 서비스
    ABAC(Attribute-Based Access Control) 구현
    """

    def __init__(
        self,
        storage: PolicyStorage,
        cache: CacheService,
        audit_logger: AuditLogger
    ):
        self.storage = storage
        self.cache = cache
        self.audit_logger = audit_logger

    async def evaluate(
        self,
        request: PolicyRequest
    ) -> PolicyDecision:
        """
        정책 평가

        평가 순서:
        1. 명시적 DENY는 항상 우선
        2. ALLOW가 있어야 허용
        3. 기본값은 DENY (fail-close)
        """
        start_time = datetime.utcnow()
        matched_rules = []

        # 적용 가능한 모든 정책 로드
        policies = await self._get_applicable_policies(request)

        # 모든 규칙 수집 및 우선순위 정렬
        all_rules = []
        for policy in policies:
            if policy.enabled:
                all_rules.extend(policy.rules)

        all_rules.sort(key=lambda r: r.priority, reverse=True)

        # 규칙 평가
        has_allow = False
        deny_reason = None

        for rule in all_rules:
            if self._matches_rule(rule, request):
                matched_rules.append(rule.rule_id)

                if rule.effect == PolicyEffect.DENY:
                    # 명시적 DENY - 즉시 거부
                    decision = PolicyDecision(
                        allow=False,
                        reason=f"Denied by rule: {rule.name}",
                        matched_rules=matched_rules,
                        evaluated_at=start_time
                    )
                    await self._log_decision(request, decision)
                    return decision

                elif rule.effect == PolicyEffect.ALLOW:
                    has_allow = True

        # 결정
        if has_allow:
            decision = PolicyDecision(
                allow=True,
                reason="Allowed by policy",
                matched_rules=matched_rules,
                evaluated_at=start_time
            )
        else:
            decision = PolicyDecision(
                allow=False,
                reason="No matching ALLOW policy (implicit deny)",
                matched_rules=matched_rules,
                evaluated_at=start_time
            )

        await self._log_decision(request, decision)
        return decision

    def _matches_rule(
        self,
        rule: PolicyRule,
        request: PolicyRequest
    ) -> bool:
        """규칙 매칭 확인"""
        # 액션 매칭
        if not self._matches_pattern(request.action, rule.actions):
            return False

        # 리소스 매칭
        if not self._matches_pattern(request.resource, rule.resources):
            return False

        # 조건 평가
        for condition in rule.conditions:
            if not self._evaluate_condition(condition, request.context):
                return False

        return True

    def _matches_pattern(
        self,
        value: str,
        patterns: List[str]
    ) -> bool:
        """와일드카드 패턴 매칭"""
        for pattern in patterns:
            if pattern == "*":
                return True
            if fnmatch.fnmatch(value, pattern):
                return True
        return False

    def _evaluate_condition(
        self,
        condition: PolicyCondition,
        context: Dict
    ) -> bool:
        """조건 평가"""
        # 중첩 필드 접근 (예: "user.role")
        actual_value = self._get_nested_value(context, condition.field)

        if actual_value is None:
            return False

        op = condition.operator
        expected = condition.value

        if op == PolicyConditionOperator.EQUALS:
            return actual_value == expected
        elif op == PolicyConditionOperator.NOT_EQUALS:
            return actual_value != expected
        elif op == PolicyConditionOperator.IN:
            return actual_value in expected
        elif op == PolicyConditionOperator.NOT_IN:
            return actual_value not in expected
        elif op == PolicyConditionOperator.CONTAINS:
            return expected in actual_value
        elif op == PolicyConditionOperator.STARTS_WITH:
            return str(actual_value).startswith(expected)
        elif op == PolicyConditionOperator.GREATER_THAN:
            return actual_value > expected
        elif op == PolicyConditionOperator.LESS_THAN:
            return actual_value < expected
        elif op == PolicyConditionOperator.REGEX:
            return bool(re.match(expected, str(actual_value)))

        return False

    def _get_nested_value(self, data: Dict, path: str) -> Any:
        """중첩된 딕셔너리에서 값 추출"""
        keys = path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value

    async def _log_decision(
        self,
        request: PolicyRequest,
        decision: PolicyDecision
    ):
        """정책 결정 감사 로그"""
        await self.audit_logger.log(
            event_type="policy_evaluation",
            action=request.action,
            resource=request.resource,
            decision="allow" if decision.allow else "deny",
            reason=decision.reason,
            matched_rules=decision.matched_rules,
            context=request.context
        )

    # ==================== Policy Management ====================

    async def create_policy(
        self,
        policy: Policy,
        requester: AuthContext
    ) -> PolicyResult:
        """정책 생성"""
        # 문법 검증
        validation = self._validate_policy(policy)
        if not validation.valid:
            return PolicyResult(
                success=False,
                error=validation.errors
            )

        # 충돌 검사
        conflicts = await self._check_conflicts(policy)
        if conflicts:
            return PolicyResult(
                success=False,
                error=f"Policy conflicts detected: {conflicts}"
            )

        policy.created_at = datetime.utcnow()
        policy.updated_at = datetime.utcnow()

        await self.storage.save(policy)
        await self.cache.invalidate("policies:*")

        return PolicyResult(
            success=True,
            policy_id=policy.policy_id
        )

    def _validate_policy(self, policy: Policy) -> ValidationResult:
        """정책 문법 검증"""
        errors = []

        for rule in policy.rules:
            # 액션 패턴 검증
            for action in rule.actions:
                if not self._is_valid_action_pattern(action):
                    errors.append(f"Invalid action pattern: {action}")

            # 리소스 패턴 검증
            for resource in rule.resources:
                if not self._is_valid_resource_pattern(resource):
                    errors.append(f"Invalid resource pattern: {resource}")

            # 조건 검증
            for condition in rule.conditions:
                if condition.operator not in PolicyConditionOperator:
                    errors.append(f"Invalid operator: {condition.operator}")

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors
        )
```

---

## 5. Secrets Vault Integration

### 5.1 Secrets Manager

```python
from abc import ABC, abstractmethod
from typing import Optional, Dict
from enum import Enum

class SecretType(Enum):
    API_KEY = "api_key"
    PASSWORD = "password"
    CERTIFICATE = "certificate"
    TOKEN = "token"
    CONNECTION_STRING = "connection_string"

class SecretsManager(ABC):
    """시크릿 관리 추상 클래스"""

    @abstractmethod
    async def get_secret(self, path: str) -> Optional[str]:
        pass

    @abstractmethod
    async def set_secret(self, path: str, value: str, metadata: Dict = None) -> bool:
        pass

    @abstractmethod
    async def delete_secret(self, path: str) -> bool:
        pass

    @abstractmethod
    async def rotate_secret(self, path: str) -> str:
        pass

class HashiCorpVaultManager(SecretsManager):
    """HashiCorp Vault 통합"""

    def __init__(self, vault_addr: str, token: str):
        self.client = hvac.Client(url=vault_addr, token=token)
        self.mount_point = "agentops"

    async def get_secret(self, path: str) -> Optional[str]:
        try:
            result = self.client.secrets.kv.v2.read_secret_version(
                path=path,
                mount_point=self.mount_point
            )
            return result["data"]["data"]["value"]
        except Exception as e:
            logger.error(f"Failed to get secret {path}: {e}")
            return None

    async def set_secret(
        self,
        path: str,
        value: str,
        metadata: Dict = None
    ) -> bool:
        try:
            self.client.secrets.kv.v2.create_or_update_secret(
                path=path,
                secret={"value": value, "metadata": metadata or {}},
                mount_point=self.mount_point
            )
            return True
        except Exception as e:
            logger.error(f"Failed to set secret {path}: {e}")
            return False

    async def rotate_secret(self, path: str) -> str:
        """시크릿 자동 로테이션"""
        # 새 값 생성 (API 키의 경우 외부 서비스와 연동 필요)
        new_value = await self._generate_new_secret(path)

        # 이전 버전 보관 (롤백용)
        old_value = await self.get_secret(path)
        await self.set_secret(
            f"{path}/previous",
            old_value,
            {"rotated_at": datetime.utcnow().isoformat()}
        )

        # 새 값 저장
        await self.set_secret(
            path,
            new_value,
            {"rotated_at": datetime.utcnow().isoformat()}
        )

        return new_value

class SecretsService:
    """
    시크릿 서비스
    에이전트용 시크릿 관리 및 주입
    """

    def __init__(
        self,
        vault: SecretsManager,
        cache: CacheService,
        audit_logger: AuditLogger
    ):
        self.vault = vault
        self.cache = cache
        self.audit_logger = audit_logger
        self._secret_ttl = 300  # 5분 캐시

    async def get_agent_secrets(
        self,
        agent_id: str,
        requester: AuthContext
    ) -> Dict[str, str]:
        """
        에이전트용 시크릿 조회
        """
        # 권한 확인
        if not await self._check_secret_access(agent_id, requester):
            raise PermissionError(f"Access denied to secrets for agent {agent_id}")

        cache_key = f"secrets:{agent_id}"

        # 캐시 확인
        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        # Vault에서 조회
        secrets = {}
        secret_paths = await self._get_agent_secret_paths(agent_id)

        for name, path in secret_paths.items():
            value = await self.vault.get_secret(path)
            if value:
                secrets[name] = value

        # 캐시 저장
        await self.cache.set(cache_key, secrets, ttl=self._secret_ttl)

        # 감사 로그
        await self.audit_logger.log(
            event_type="secret_access",
            agent_id=agent_id,
            requester=requester.user_id,
            secret_names=list(secrets.keys())
        )

        return secrets

    async def inject_secrets_to_runtime(
        self,
        agent_id: str,
        runtime_id: str
    ) -> bool:
        """
        런타임에 시크릿 주입
        환경 변수 또는 파일로 제공
        """
        secrets = await self.get_agent_secrets(
            agent_id,
            AuthContext(user_id="system", role="service")
        )

        # 런타임에 전달 (예: K8s Secret 업데이트)
        await self._update_runtime_secrets(runtime_id, secrets)

        return True
```

---

## 6. 다음 단계

- [Observability Layer](./observability-layer) - 추적, 메트릭, 로깅 계층
- [Data Plane](./data-plane) - 에이전트 실행 환경
- [분산 추적 구현](../implementation/tracing) - 실제 구현 가이드
