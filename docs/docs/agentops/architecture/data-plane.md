---
sidebar_position: 4
title: "Data Plane"
description: "AgentOps Data Plane - Agent Runtime 및 A2A 통신"
---

# Data Plane 설계

Data Plane은 AI 에이전트가 **실제로 실행**되는 계층입니다. Agent Runtime, A2A 통신 버스, 그리고 LLM 연동을 담당합니다.

---

## 1. Data Plane 개요

### 1.1 책임 영역

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Data Plane Responsibilities                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Agent Runtime  │  │   A2A Comms     │  │  LLM Gateway    │         │
│  │   Environment   │  │   Bus           │  │   & Routing     │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Execution env │  │ • Message queue │  │ • Provider mgmt │         │
│  │ • Lifecycle mgmt│  │ • Service mesh  │  │ • Load balancing│         │
│  │ • Resource mgmt │  │ • Discovery     │  │ • Failover      │         │
│  │ • Isolation     │  │ • Routing       │  │ • Rate limiting │         │
│  │ • Health checks │  │ • Protocol      │  │ • Caching       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Session Mgmt   │  │   Tool Runtime  │  │  Memory Store   │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • State mgmt    │  │ • Tool registry │  │ • Short-term    │         │
│  │ • Context       │  │ • Sandboxing    │  │ • Long-term     │         │
│  │ • Persistence   │  │ • Execution     │  │ • Retrieval     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Plane Architecture                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                         ┌─────────────────┐                             │
│                         │   API Gateway   │                             │
│                         └────────┬────────┘                             │
│                                  │                                       │
│         ┌────────────────────────┼────────────────────────┐             │
│         │                        │                        │             │
│         ▼                        ▼                        ▼             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │  Agent Runtime  │     │  Agent Runtime  │     │  Agent Runtime  │   │
│  │    Cluster A    │     │    Cluster B    │     │    Cluster C    │   │
│  │  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │   │
│  │  │ Runtime 1 │  │     │  │ Runtime 1 │  │     │  │ Runtime 1 │  │   │
│  │  │┌─────────┐│  │     │  │┌─────────┐│  │     │  │┌─────────┐│  │   │
│  │  ││Agent Orch││ │     │  ││Agent Flightω ││   │  ││Agent Hotelω ││  │
│  │  │└─────────┘│  │     │  │└─────────┘│  │     │  │└─────────┘│  │   │
│  │  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │   │
│  │  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │   │
│  │  │ Runtime 2 │  │     │  │ Runtime 2 │  │     │  │ Runtime 2 │  │   │
│  │  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │   │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘   │
│           │                       │                       │             │
│           └───────────────────────┼───────────────────────┘             │
│                                   │                                      │
│                    ┌──────────────▼──────────────┐                      │
│                    │    A2A Communication Bus    │                      │
│                    │  (NATS / Kafka / RabbitMQ)  │                      │
│                    └──────────────┬──────────────┘                      │
│                                   │                                      │
│         ┌─────────────────────────┼─────────────────────────┐           │
│         │                         │                         │           │
│         ▼                         ▼                         ▼           │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐ │
│  │   LLM Gateway   │      │  Tool Registry  │      │  Memory Store   │ │
│  │                 │      │   & Executor    │      │                 │ │
│  │ ┌─────────────┐ │      │ ┌─────────────┐ │      │ ┌─────────────┐ │ │
│  │ │   OpenAI    │ │      │ │  Web Search │ │      │ │    Redis    │ │ │
│  │ │  Anthropic  │ │      │ │  Database   │ │      │ │   (Short)   │ │ │
│  │ │   Google    │ │      │ │    API      │ │      │ ├─────────────┤ │ │
│  │ │   Local     │ │      │ │   Code      │ │      │ │   Vector    │ │ │
│  │ └─────────────┘ │      │ └─────────────┘ │      │ │   (Long)    │ │ │
│  └─────────────────┘      └─────────────────┘      │ └─────────────┘ │ │
│                                                     └─────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent Runtime

### 2.1 Runtime 설계

```python
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from datetime import datetime
import asyncio

class RuntimeStatus(Enum):
    INITIALIZING = "initializing"
    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"

@dataclass
class RuntimeConfig:
    """Runtime 설정"""
    # 리소스 제한
    max_memory_mb: int = 512
    max_cpu_percent: float = 100.0
    max_concurrent_requests: int = 10

    # 타임아웃
    request_timeout_seconds: int = 300
    llm_timeout_seconds: int = 60
    tool_timeout_seconds: int = 30

    # 재시도
    max_retries: int = 3
    retry_backoff_seconds: float = 1.0

    # 텔레메트리
    tracing_enabled: bool = True
    metrics_enabled: bool = True
    logging_level: str = "INFO"

@dataclass
class RuntimeContext:
    """실행 컨텍스트"""
    runtime_id: str
    agent_id: str
    agent_version: str
    session_id: str
    request_id: str
    trace_id: str
    span_id: str
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class AgentRuntime:
    """
    에이전트 실행 환경
    에이전트의 생명주기와 실행을 관리
    """

    def __init__(
        self,
        runtime_id: str,
        config: RuntimeConfig,
        agent_factory: Callable,
        control_plane: ControlPlaneClient,
        observability: ObservabilityClient
    ):
        self.runtime_id = runtime_id
        self.config = config
        self.agent_factory = agent_factory
        self.control_plane = control_plane
        self.observability = observability

        self.status = RuntimeStatus.INITIALIZING
        self._agent = None
        self._active_requests: Dict[str, asyncio.Task] = {}
        self._semaphore = asyncio.Semaphore(config.max_concurrent_requests)

    # ==================== Lifecycle Management ====================

    async def initialize(self):
        """Runtime 초기화"""
        try:
            # 1. 설정 로드
            agent_config = await self.control_plane.get_agent_config(
                self.runtime_id
            )

            # 2. 시크릿 주입
            secrets = await self.control_plane.get_secrets(
                self.runtime_id
            )

            # 3. 에이전트 인스턴스 생성
            self._agent = await self.agent_factory(
                config=agent_config,
                secrets=secrets,
                observability=self.observability
            )

            # 4. 헬스체크 등록
            await self.control_plane.register_runtime(
                runtime_id=self.runtime_id,
                health_endpoint=f"/health/{self.runtime_id}"
            )

            self.status = RuntimeStatus.READY
            self.observability.logger.info(
                "Runtime initialized",
                runtime_id=self.runtime_id
            )

        except Exception as e:
            self.status = RuntimeStatus.ERROR
            self.observability.logger.error(
                "Runtime initialization failed",
                error=str(e)
            )
            raise

    async def shutdown(self, graceful: bool = True):
        """Runtime 종료"""
        self.status = RuntimeStatus.STOPPING

        if graceful:
            # 진행 중인 요청 완료 대기
            if self._active_requests:
                self.observability.logger.info(
                    f"Waiting for {len(self._active_requests)} active requests"
                )
                await asyncio.gather(
                    *self._active_requests.values(),
                    return_exceptions=True
                )

        # 에이전트 정리
        if self._agent and hasattr(self._agent, 'cleanup'):
            await self._agent.cleanup()

        # 레지스트리에서 해제
        await self.control_plane.deregister_runtime(self.runtime_id)

        self.status = RuntimeStatus.STOPPED
        self.observability.logger.info("Runtime shutdown complete")

    # ==================== Request Handling ====================

    async def handle_request(
        self,
        request: AgentRequest,
        context: RuntimeContext
    ) -> AgentResponse:
        """
        에이전트 요청 처리
        """
        if self.status != RuntimeStatus.READY:
            raise RuntimeError(f"Runtime not ready: {self.status}")

        async with self._semaphore:
            request_id = context.request_id
            self._active_requests[request_id] = asyncio.current_task()

            try:
                self.status = RuntimeStatus.RUNNING
                self.observability.metrics.request_in_progress.labels(
                    agent=context.agent_id
                ).inc()

                # 트레이싱 시작
                with self.observability.tracer.start_agent_span(
                    name=f"agent.{context.agent_id}.request",
                    kind=AgentSpanKind.AGENT_REQUEST,
                    attributes=AgentSpanAttributes(
                        agent_id=context.agent_id,
                        agent_name=self._agent.name,
                        agent_version=context.agent_version,
                        session_id=context.session_id,
                        trace_id=context.trace_id
                    )
                ) as span:
                    # 가드레일 - 입력 검증
                    input_validation = await self._validate_input(request)
                    if not input_validation.valid:
                        return AgentResponse(
                            success=False,
                            error=f"Input validation failed: {input_validation.reason}",
                            guardrail_triggered=True
                        )

                    # 에이전트 실행
                    start_time = datetime.utcnow()

                    result = await asyncio.wait_for(
                        self._agent.process(request, context),
                        timeout=self.config.request_timeout_seconds
                    )

                    duration = (datetime.utcnow() - start_time).total_seconds()

                    # 가드레일 - 출력 검증
                    output_validation = await self._validate_output(result)
                    if not output_validation.valid:
                        result = await self._sanitize_output(result)
                        span.set_attribute("guardrail.output_sanitized", True)

                    # 메트릭 기록
                    self.observability.metrics.record_request(
                        action=request.action,
                        status="success",
                        duration=duration
                    )

                    # 비동기 평가 트리거 (샘플링)
                    if self._should_evaluate():
                        asyncio.create_task(
                            self._trigger_evaluation(request, result, context)
                        )

                    return AgentResponse(
                        success=True,
                        data=result,
                        metadata={
                            "duration_ms": duration * 1000,
                            "trace_id": context.trace_id
                        }
                    )

            except asyncio.TimeoutError:
                self.observability.metrics.record_request(
                    action=request.action,
                    status="timeout",
                    duration=self.config.request_timeout_seconds
                )
                return AgentResponse(
                    success=False,
                    error="Request timeout"
                )

            except Exception as e:
                self.observability.logger.log_error(e, {"request_id": request_id})
                self.observability.metrics.record_request(
                    action=request.action,
                    status="error",
                    duration=0
                )
                return AgentResponse(
                    success=False,
                    error=str(e)
                )

            finally:
                del self._active_requests[request_id]
                self.observability.metrics.request_in_progress.labels(
                    agent=context.agent_id
                ).dec()

                if not self._active_requests:
                    self.status = RuntimeStatus.READY

    # ==================== Health & Status ====================

    async def health_check(self) -> HealthStatus:
        """헬스 체크"""
        checks = {
            "runtime_status": self.status == RuntimeStatus.READY or self.status == RuntimeStatus.RUNNING,
            "agent_loaded": self._agent is not None,
            "control_plane_connected": await self.control_plane.ping(),
            "under_capacity": len(self._active_requests) < self.config.max_concurrent_requests
        }

        all_healthy = all(checks.values())

        return HealthStatus(
            healthy=all_healthy,
            checks=checks,
            active_requests=len(self._active_requests),
            max_requests=self.config.max_concurrent_requests
        )

    async def get_metrics(self) -> Dict[str, Any]:
        """Runtime 메트릭"""
        return {
            "runtime_id": self.runtime_id,
            "status": self.status.value,
            "active_requests": len(self._active_requests),
            "uptime_seconds": (datetime.utcnow() - self._start_time).total_seconds()
        }
```

### 2.2 에이전트 기본 클래스

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class BaseAgent(ABC):
    """
    에이전트 기본 클래스
    모든 에이전트는 이 클래스를 상속
    """

    def __init__(
        self,
        agent_id: str,
        name: str,
        version: str,
        config: Dict[str, Any],
        llm_client: LLMClient,
        tool_registry: ToolRegistry,
        memory: MemoryStore,
        observability: ObservabilityClient
    ):
        self.agent_id = agent_id
        self.name = name
        self.version = version
        self.config = config

        self.llm = llm_client
        self.tools = tool_registry
        self.memory = memory
        self.observability = observability

        self.tracer = observability.tracer
        self.metrics = observability.metrics
        self.logger = observability.logger

    @abstractmethod
    async def process(
        self,
        request: AgentRequest,
        context: RuntimeContext
    ) -> Any:
        """
        요청 처리 - 서브클래스에서 구현
        """
        pass

    # ==================== Common Agent Operations ====================

    async def think(
        self,
        prompt: str,
        context: Dict[str, Any] = None
    ) -> str:
        """추론 수행"""
        with self.tracer.start_span("reasoning") as span:
            span.set_attribute("agent.span_kind", "agent.reasoning")

            # 메모리에서 관련 컨텍스트 검색
            relevant_memories = await self.memory.search(
                query=prompt,
                limit=5
            )

            # 프롬프트 구성
            full_prompt = self._build_prompt(
                prompt,
                context,
                relevant_memories
            )

            # LLM 호출
            response = await self.llm.generate(
                prompt=full_prompt,
                model=self.config.get("default_model", "gpt-4o")
            )

            # 추론 과정 로깅
            self.logger.log_reasoning(
                step="think",
                thought=response[:200],
                decision="continue"
            )

            return response

    async def use_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Any:
        """도구 사용"""
        with self.tracer.start_span(f"tool.{tool_name}") as span:
            span.set_attribute("agent.span_kind", "agent.tool_call")
            span.set_attribute("tool.name", tool_name)

            # 도구 조회
            tool = await self.tools.get(tool_name)
            if not tool:
                raise ToolNotFoundError(f"Tool not found: {tool_name}")

            # 도구 실행
            start_time = datetime.utcnow()
            result = await tool.execute(parameters)
            duration = (datetime.utcnow() - start_time).total_seconds()

            # 메트릭 기록
            self.metrics.record_tool_call(
                tool=tool_name,
                status="success",
                duration=duration
            )

            # 로깅
            self.logger.log_tool_call(
                tool_name=tool_name,
                input_data=parameters,
                output_data=result,
                duration_ms=duration * 1000,
                status="success"
            )

            return result

    async def delegate(
        self,
        target_agent: str,
        task: Dict[str, Any],
        timeout: float = 60.0
    ) -> Any:
        """다른 에이전트에게 위임"""
        with self.tracer.start_span(f"delegate.{target_agent}") as span:
            span.set_attribute("agent.span_kind", "agent.delegation")
            span.set_attribute("target_agent", target_agent)

            # A2A 메시지 전송
            response = await self.a2a_client.send_task(
                target=target_agent,
                task=task,
                timeout=timeout
            )

            return response

    async def remember(
        self,
        content: str,
        metadata: Dict[str, Any] = None
    ):
        """메모리에 저장"""
        await self.memory.store(
            content=content,
            metadata={
                "agent_id": self.agent_id,
                "timestamp": datetime.utcnow().isoformat(),
                **(metadata or {})
            }
        )

    async def recall(
        self,
        query: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """메모리에서 검색"""
        return await self.memory.search(
            query=query,
            limit=limit,
            filters={"agent_id": self.agent_id}
        )

    async def cleanup(self):
        """정리 작업"""
        # 서브클래스에서 필요시 오버라이드
        pass
```

---

## 3. A2A Communication Bus

### 3.1 메시지 프로토콜

```python
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime
import uuid

class MessageType(Enum):
    REQUEST = "request"           # 요청
    RESPONSE = "response"         # 응답
    NOTIFICATION = "notification" # 알림 (응답 불필요)
    BROADCAST = "broadcast"       # 브로드캐스트
    STREAM_START = "stream_start" # 스트림 시작
    STREAM_DATA = "stream_data"   # 스트림 데이터
    STREAM_END = "stream_end"     # 스트림 종료

class MessagePriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    URGENT = 3

@dataclass
class A2AMessage:
    """
    A2A 프로토콜 메시지
    에이전트 간 통신의 기본 단위
    """
    # 메시지 식별
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: Optional[str] = None  # 요청-응답 연결
    conversation_id: Optional[str] = None  # 대화 그룹

    # 라우팅
    source_agent: str = ""
    target_agent: str = ""  # 또는 브로드캐스트 토픽

    # 메시지 타입
    message_type: MessageType = MessageType.REQUEST
    priority: MessagePriority = MessagePriority.NORMAL

    # 페이로드
    action: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)

    # 메타데이터
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    ttl_seconds: int = 300  # Time-to-live
    trace_id: Optional[str] = None
    span_id: Optional[str] = None

    # 보안
    auth_token: Optional[str] = None
    signature: Optional[str] = None

@dataclass
class A2AResponse:
    """A2A 응답"""
    message_id: str
    correlation_id: str
    source_agent: str
    success: bool
    data: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class A2AMessageBus:
    """
    A2A 메시지 버스
    에이전트 간 비동기 통신 관리
    """

    def __init__(
        self,
        broker_url: str,
        agent_id: str,
        observability: ObservabilityClient
    ):
        self.broker_url = broker_url
        self.agent_id = agent_id
        self.observability = observability

        self._handlers: Dict[str, Callable] = {}
        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._subscriptions: List[str] = []

    # ==================== Connection Management ====================

    async def connect(self):
        """브로커 연결"""
        # NATS 예시
        self._nc = await nats.connect(self.broker_url)
        self._js = self._nc.jetstream()

        # 에이전트 전용 큐 구독
        await self._nc.subscribe(
            f"agent.{self.agent_id}",
            cb=self._handle_message
        )

        self.observability.logger.info(
            f"Connected to message bus",
            broker=self.broker_url
        )

    async def disconnect(self):
        """연결 해제"""
        await self._nc.close()

    # ==================== Messaging ====================

    async def send(
        self,
        message: A2AMessage
    ) -> None:
        """메시지 전송 (fire-and-forget)"""
        message.source_agent = self.agent_id

        # 트레이스 컨텍스트 주입
        span = trace.get_current_span()
        if span:
            ctx = span.get_span_context()
            message.trace_id = format(ctx.trace_id, '032x')
            message.span_id = format(ctx.span_id, '016x')

        # 직렬화 및 전송
        data = json.dumps(message.__dict__).encode()

        subject = f"agent.{message.target_agent}"
        await self._nc.publish(subject, data)

        self.observability.logger.info(
            f"Message sent",
            target=message.target_agent,
            action=message.action
        )

    async def request(
        self,
        target_agent: str,
        action: str,
        payload: Dict[str, Any],
        timeout: float = 30.0
    ) -> A2AResponse:
        """요청-응답 패턴"""
        message = A2AMessage(
            target_agent=target_agent,
            message_type=MessageType.REQUEST,
            action=action,
            payload=payload
        )

        # 응답 대기용 Future 생성
        future = asyncio.get_event_loop().create_future()
        self._pending_requests[message.message_id] = future

        try:
            await self.send(message)

            # 응답 대기
            response = await asyncio.wait_for(future, timeout=timeout)
            return response

        except asyncio.TimeoutError:
            raise A2ATimeoutError(
                f"Request to {target_agent} timed out after {timeout}s"
            )

        finally:
            del self._pending_requests[message.message_id]

    async def broadcast(
        self,
        topic: str,
        action: str,
        payload: Dict[str, Any]
    ):
        """브로드캐스트 메시지"""
        message = A2AMessage(
            target_agent=topic,  # 토픽으로 사용
            message_type=MessageType.BROADCAST,
            action=action,
            payload=payload
        )

        await self._nc.publish(f"broadcast.{topic}", json.dumps(message.__dict__).encode())

    async def subscribe_topic(
        self,
        topic: str,
        handler: Callable
    ):
        """토픽 구독"""
        async def wrapper(msg):
            data = json.loads(msg.data.decode())
            message = A2AMessage(**data)
            await handler(message)

        sub = await self._nc.subscribe(f"broadcast.{topic}", cb=wrapper)
        self._subscriptions.append(sub)

    # ==================== Message Handling ====================

    async def _handle_message(self, msg):
        """수신 메시지 처리"""
        try:
            data = json.loads(msg.data.decode())
            message = A2AMessage(**data)

            # 트레이스 컨텍스트 복원
            if message.trace_id:
                # OpenTelemetry 컨텍스트 복원
                pass

            if message.message_type == MessageType.RESPONSE:
                # 응답 메시지 처리
                await self._handle_response(message)

            elif message.message_type == MessageType.REQUEST:
                # 요청 메시지 처리
                await self._handle_request(message)

            elif message.message_type == MessageType.NOTIFICATION:
                # 알림 처리
                await self._handle_notification(message)

        except Exception as e:
            self.observability.logger.error(f"Message handling error: {e}")

    async def _handle_response(self, message: A2AMessage):
        """응답 메시지 처리"""
        correlation_id = message.correlation_id
        if correlation_id in self._pending_requests:
            future = self._pending_requests[correlation_id]
            response = A2AResponse(
                message_id=message.message_id,
                correlation_id=correlation_id,
                source_agent=message.source_agent,
                success=message.payload.get("success", True),
                data=message.payload.get("data"),
                error=message.payload.get("error")
            )
            future.set_result(response)

    async def _handle_request(self, message: A2AMessage):
        """요청 메시지 처리"""
        action = message.action

        if action in self._handlers:
            handler = self._handlers[action]
            try:
                result = await handler(message.payload)

                # 응답 전송
                response = A2AMessage(
                    target_agent=message.source_agent,
                    correlation_id=message.message_id,
                    message_type=MessageType.RESPONSE,
                    action=f"{action}_response",
                    payload={"success": True, "data": result}
                )
                await self.send(response)

            except Exception as e:
                # 에러 응답
                response = A2AMessage(
                    target_agent=message.source_agent,
                    correlation_id=message.message_id,
                    message_type=MessageType.RESPONSE,
                    action=f"{action}_response",
                    payload={"success": False, "error": str(e)}
                )
                await self.send(response)

    def register_handler(
        self,
        action: str,
        handler: Callable
    ):
        """액션 핸들러 등록"""
        self._handlers[action] = handler
```

---

## 4. LLM Gateway

### 4.1 Provider 추상화

```python
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, AsyncIterator
from dataclasses import dataclass
from enum import Enum

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    AZURE_OPENAI = "azure_openai"
    LOCAL = "local"

@dataclass
class LLMRequest:
    """LLM 요청"""
    prompt: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 2000
    stop_sequences: List[str] = None
    tools: List[Dict] = None  # Function calling
    stream: bool = False

@dataclass
class LLMResponse:
    """LLM 응답"""
    content: str
    model: str
    provider: LLMProvider
    usage: Dict[str, int]  # prompt_tokens, completion_tokens, total_tokens
    finish_reason: str
    tool_calls: List[Dict] = None
    latency_ms: float = 0

class BaseLLMClient(ABC):
    """LLM 클라이언트 추상 클래스"""

    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        pass

    @abstractmethod
    async def stream(self, request: LLMRequest) -> AsyncIterator[str]:
        pass

class OpenAIClient(BaseLLMClient):
    """OpenAI 클라이언트"""

    def __init__(self, api_key: str, organization: str = None):
        self.client = AsyncOpenAI(api_key=api_key, organization=organization)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        start_time = time.time()

        response = await self.client.chat.completions.create(
            model=request.model,
            messages=[{"role": "user", "content": request.prompt}],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stop=request.stop_sequences,
            tools=request.tools
        )

        latency = (time.time() - start_time) * 1000

        return LLMResponse(
            content=response.choices[0].message.content,
            model=request.model,
            provider=LLMProvider.OPENAI,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            finish_reason=response.choices[0].finish_reason,
            tool_calls=response.choices[0].message.tool_calls,
            latency_ms=latency
        )

class AnthropicClient(BaseLLMClient):
    """Anthropic Claude 클라이언트"""

    def __init__(self, api_key: str):
        self.client = AsyncAnthropic(api_key=api_key)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        start_time = time.time()

        response = await self.client.messages.create(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=[{"role": "user", "content": request.prompt}],
            temperature=request.temperature
        )

        latency = (time.time() - start_time) * 1000

        return LLMResponse(
            content=response.content[0].text,
            model=request.model,
            provider=LLMProvider.ANTHROPIC,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            },
            finish_reason=response.stop_reason,
            latency_ms=latency
        )

class LLMGateway:
    """
    LLM Gateway
    여러 LLM 프로바이더를 통합 관리
    """

    def __init__(
        self,
        config: LLMGatewayConfig,
        observability: ObservabilityClient
    ):
        self.config = config
        self.observability = observability

        self._clients: Dict[LLMProvider, BaseLLMClient] = {}
        self._model_routing: Dict[str, LLMProvider] = {}
        self._rate_limiters: Dict[LLMProvider, RateLimiter] = {}
        self._cache: ResponseCache = None

    async def initialize(self):
        """게이트웨이 초기화"""
        # 클라이언트 초기화
        if self.config.openai_api_key:
            self._clients[LLMProvider.OPENAI] = OpenAIClient(
                self.config.openai_api_key
            )
            self._model_routing.update({
                "gpt-4": LLMProvider.OPENAI,
                "gpt-4o": LLMProvider.OPENAI,
                "gpt-4-turbo": LLMProvider.OPENAI,
                "gpt-3.5-turbo": LLMProvider.OPENAI
            })

        if self.config.anthropic_api_key:
            self._clients[LLMProvider.ANTHROPIC] = AnthropicClient(
                self.config.anthropic_api_key
            )
            self._model_routing.update({
                "claude-3-opus": LLMProvider.ANTHROPIC,
                "claude-3-sonnet": LLMProvider.ANTHROPIC,
                "claude-3-haiku": LLMProvider.ANTHROPIC,
                "claude-3.5-sonnet": LLMProvider.ANTHROPIC
            })

        # Rate limiter 초기화
        for provider in self._clients:
            self._rate_limiters[provider] = RateLimiter(
                requests_per_minute=self.config.rate_limits.get(
                    provider.value, 60
                )
            )

        # 캐시 초기화
        if self.config.cache_enabled:
            self._cache = ResponseCache(
                redis_url=self.config.cache_redis_url,
                ttl=self.config.cache_ttl
            )

    async def generate(
        self,
        prompt: str,
        model: str = None,
        **kwargs
    ) -> LLMResponse:
        """
        LLM 생성 요청
        라우팅, 폴백, 캐싱 처리
        """
        model = model or self.config.default_model

        # 캐시 확인
        if self._cache:
            cached = await self._cache.get(prompt, model)
            if cached:
                self.observability.metrics.llm_calls_total.labels(
                    agent="gateway",
                    model=model,
                    status="cache_hit"
                ).inc()
                return cached

        # 프로바이더 결정
        provider = self._get_provider(model)
        if not provider:
            raise ValueError(f"No provider found for model: {model}")

        # Rate limiting
        await self._rate_limiters[provider].acquire()

        # 요청 생성
        request = LLMRequest(
            prompt=prompt,
            model=model,
            **kwargs
        )

        # 트레이싱
        with self.observability.tracer.start_span(f"llm.{model}") as span:
            span.set_attribute("llm.model", model)
            span.set_attribute("llm.provider", provider.value)

            try:
                response = await self._clients[provider].generate(request)

                # 메트릭 기록
                self.observability.metrics.record_llm_call(
                    model=model,
                    status="success",
                    duration=response.latency_ms / 1000,
                    prompt_tokens=response.usage["prompt_tokens"],
                    completion_tokens=response.usage["completion_tokens"]
                )

                # 캐시 저장
                if self._cache:
                    await self._cache.set(prompt, model, response)

                return response

            except Exception as e:
                # 폴백 시도
                fallback_response = await self._try_fallback(
                    request, provider, e
                )
                if fallback_response:
                    return fallback_response

                self.observability.metrics.llm_calls_total.labels(
                    agent="gateway",
                    model=model,
                    status="error"
                ).inc()
                raise

    async def _try_fallback(
        self,
        request: LLMRequest,
        failed_provider: LLMProvider,
        error: Exception
    ) -> Optional[LLMResponse]:
        """폴백 프로바이더 시도"""
        fallback_map = {
            LLMProvider.OPENAI: LLMProvider.ANTHROPIC,
            LLMProvider.ANTHROPIC: LLMProvider.OPENAI
        }

        fallback_provider = fallback_map.get(failed_provider)
        if not fallback_provider or fallback_provider not in self._clients:
            return None

        # 모델 매핑
        fallback_model = self._map_model_to_provider(
            request.model, fallback_provider
        )

        self.observability.logger.warning(
            f"Falling back from {failed_provider} to {fallback_provider}",
            original_error=str(error)
        )

        try:
            request.model = fallback_model
            return await self._clients[fallback_provider].generate(request)
        except Exception:
            return None

    def _get_provider(self, model: str) -> Optional[LLMProvider]:
        """모델에 대한 프로바이더 결정"""
        return self._model_routing.get(model)

    def _map_model_to_provider(
        self,
        model: str,
        provider: LLMProvider
    ) -> str:
        """모델을 다른 프로바이더의 동등한 모델로 매핑"""
        mapping = {
            ("gpt-4", LLMProvider.ANTHROPIC): "claude-3-opus",
            ("gpt-4o", LLMProvider.ANTHROPIC): "claude-3.5-sonnet",
            ("gpt-3.5-turbo", LLMProvider.ANTHROPIC): "claude-3-haiku",
            ("claude-3-opus", LLMProvider.OPENAI): "gpt-4",
            ("claude-3.5-sonnet", LLMProvider.OPENAI): "gpt-4o",
            ("claude-3-haiku", LLMProvider.OPENAI): "gpt-3.5-turbo"
        }
        return mapping.get((model, provider), model)
```

---

## 5. Session Management

### 5.1 세션 저장소

```python
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import redis.asyncio as redis

@dataclass
class ConversationTurn:
    """대화 턴"""
    role: str  # user, assistant, system, tool
    content: str
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SessionState:
    """세션 상태"""
    session_id: str
    user_id: str
    agent_id: str
    created_at: datetime
    updated_at: datetime
    expires_at: datetime

    # 대화 기록
    conversation: List[ConversationTurn] = field(default_factory=list)

    # 컨텍스트 변수
    context: Dict[str, Any] = field(default_factory=dict)

    # 워크플로우 상태
    workflow_state: Dict[str, Any] = field(default_factory=dict)

    # 메타데이터
    metadata: Dict[str, Any] = field(default_factory=dict)

class SessionManager:
    """
    세션 관리자
    Redis 기반 세션 상태 관리
    """

    def __init__(
        self,
        redis_url: str,
        default_ttl: int = 3600,  # 1시간
        max_conversation_length: int = 100
    ):
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self.max_conversation_length = max_conversation_length
        self._redis: redis.Redis = None

    async def connect(self):
        """Redis 연결"""
        self._redis = await redis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True
        )

    async def create_session(
        self,
        user_id: str,
        agent_id: str,
        initial_context: Dict[str, Any] = None,
        ttl: int = None
    ) -> SessionState:
        """새 세션 생성"""
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        ttl = ttl or self.default_ttl

        session = SessionState(
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            created_at=now,
            updated_at=now,
            expires_at=now + timedelta(seconds=ttl),
            context=initial_context or {}
        )

        await self._save_session(session, ttl)
        return session

    async def get_session(self, session_id: str) -> Optional[SessionState]:
        """세션 조회"""
        key = f"session:{session_id}"
        data = await self._redis.get(key)

        if not data:
            return None

        return SessionState(**json.loads(data))

    async def update_session(
        self,
        session_id: str,
        updates: Dict[str, Any]
    ) -> SessionState:
        """세션 업데이트"""
        session = await self.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)

        # 업데이트 적용
        for key, value in updates.items():
            if hasattr(session, key):
                setattr(session, key, value)

        session.updated_at = datetime.utcnow()

        # TTL 갱신
        remaining_ttl = (session.expires_at - datetime.utcnow()).total_seconds()
        await self._save_session(session, int(remaining_ttl))

        return session

    async def add_conversation_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Dict[str, Any] = None
    ):
        """대화 턴 추가"""
        session = await self.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)

        turn = ConversationTurn(
            role=role,
            content=content,
            timestamp=datetime.utcnow().isoformat(),
            metadata=metadata or {}
        )

        session.conversation.append(turn)

        # 대화 길이 제한
        if len(session.conversation) > self.max_conversation_length:
            session.conversation = session.conversation[-self.max_conversation_length:]

        await self.update_session(session_id, {"conversation": session.conversation})

    async def get_conversation_context(
        self,
        session_id: str,
        max_turns: int = 10
    ) -> List[Dict[str, str]]:
        """대화 컨텍스트 조회 (LLM 포맷)"""
        session = await self.get_session(session_id)
        if not session:
            return []

        recent_turns = session.conversation[-max_turns:]

        return [
            {"role": turn.role, "content": turn.content}
            for turn in recent_turns
        ]

    async def set_context_variable(
        self,
        session_id: str,
        key: str,
        value: Any
    ):
        """컨텍스트 변수 설정"""
        session = await self.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)

        session.context[key] = value
        await self.update_session(session_id, {"context": session.context})

    async def delete_session(self, session_id: str):
        """세션 삭제"""
        key = f"session:{session_id}"
        await self._redis.delete(key)

    async def extend_session(self, session_id: str, additional_ttl: int):
        """세션 TTL 연장"""
        session = await self.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)

        session.expires_at = datetime.utcnow() + timedelta(seconds=additional_ttl)
        await self._save_session(session, additional_ttl)

    async def _save_session(self, session: SessionState, ttl: int):
        """세션 저장"""
        key = f"session:{session.session_id}"
        data = json.dumps(session.__dict__, default=str)
        await self._redis.setex(key, ttl, data)
```

---

## 6. 다음 단계

- [분산 추적 구현](../implementation/tracing) - OpenTelemetry 상세 구현
- [Kubernetes 배포](../deployment/kubernetes) - Data Plane 배포
- [스케일링 전략](../deployment/scaling) - 오토스케일링 설정
