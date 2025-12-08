---
sidebar_position: 2
title: "Agentic AI 서비스 설계 가이드"
description: "프로덕션 레벨의 Agentic AI 서비스를 설계하고 구축하는 완벽 가이드"
---

# Agentic AI 서비스 설계 가이드

> "좋은 에이전트 서비스는 기술적 우수성과 비즈니스 가치, 그리고 안전성의 균형 위에 세워진다."

![AI Service Architecture](https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80)

*Figure 1: Modern AI Service Architecture Concept*

---

## 1. 서비스 설계 원칙

### 1.1 핵심 설계 원칙 (Design Principles)

프로덕션 레벨의 Agentic AI 서비스를 구축할 때 반드시 고려해야 할 원칙들:

| 원칙 | 설명 | 적용 방법 |
|------|------|----------|
| **Safety First** | 안전성을 최우선으로 | 가드레일, 샌드박싱, 인간 승인 루프 |
| **Graceful Degradation** | 우아한 성능 저하 | 폴백 메커니즘, 타임아웃, 회로 차단기 |
| **Observability** | 완전한 관찰 가능성 | 분산 추적, 메트릭, 구조화된 로깅 |
| **Cost Awareness** | 비용 인식 설계 | 토큰 예산, 캐싱, 모델 라우팅 |
| **Modularity** | 모듈화된 구조 | 느슨한 결합, 높은 응집도 |
| **Human-in-the-Loop** | 인간 참여 설계 | 승인 워크플로우, 에스컬레이션 |

### 1.2 레이어드 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC AI SERVICE ARCHITECTURE              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    PRESENTATION LAYER                      │  │
│  │   [REST API] [WebSocket] [GraphQL] [CLI] [Web UI]         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    GATEWAY LAYER                           │  │
│  │   [Auth] [Rate Limit] [Load Balance] [Request Routing]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 ORCHESTRATION LAYER                        │  │
│  │   [Session Manager] [Workflow Engine] [State Machine]     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    AGENT LAYER                             │  │
│  │   [Agent Pool] [Tool Registry] [Memory Store]             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 INTEGRATION LAYER                          │  │
│  │   [LLM Providers] [External APIs] [Databases] [MCP]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                INFRASTRUCTURE LAYER                        │  │
│  │   [Kubernetes] [Message Queue] [Cache] [Object Storage]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 프로토콜 설계

### 2.1 API 프로토콜 선택

![Protocol Selection](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80)

*Figure 2: Communication Protocol Selection*

#### REST API - 동기식 요청

```yaml
# OpenAPI 3.0 스펙 예시
openapi: 3.0.0
info:
  title: Agentic AI Service API
  version: 1.0.0

paths:
  /v1/agents/{agent_id}/execute:
    post:
      summary: Execute agent task
      parameters:
        - name: agent_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TaskRequest'
      responses:
        '200':
          description: Task completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskResponse'
        '202':
          description: Task accepted (async)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskAccepted'

components:
  schemas:
    TaskRequest:
      type: object
      required:
        - task
      properties:
        task:
          type: string
          description: Task description
        context:
          type: object
          description: Additional context
        options:
          $ref: '#/components/schemas/ExecutionOptions'

    ExecutionOptions:
      type: object
      properties:
        max_tokens:
          type: integer
          default: 4096
        timeout_seconds:
          type: integer
          default: 300
        stream:
          type: boolean
          default: false
        human_approval_required:
          type: boolean
          default: false

    TaskResponse:
      type: object
      properties:
        task_id:
          type: string
        status:
          type: string
          enum: [completed, failed, requires_approval]
        result:
          type: object
        usage:
          $ref: '#/components/schemas/UsageMetrics'
        trace_id:
          type: string
```

#### WebSocket - 실시간 스트리밍

```typescript
// WebSocket 프로토콜 정의
interface AgentWebSocketProtocol {
  // 클라이언트 -> 서버
  clientMessages: {
    // 작업 시작
    start_task: {
      type: 'start_task';
      task_id: string;
      task: string;
      context?: Record<string, unknown>;
    };

    // 사용자 입력 (대화형)
    user_input: {
      type: 'user_input';
      task_id: string;
      input: string;
    };

    // 인간 승인
    human_approval: {
      type: 'human_approval';
      task_id: string;
      action_id: string;
      approved: boolean;
      feedback?: string;
    };

    // 작업 취소
    cancel_task: {
      type: 'cancel_task';
      task_id: string;
    };
  };

  // 서버 -> 클라이언트
  serverMessages: {
    // 진행 상황 업데이트
    progress: {
      type: 'progress';
      task_id: string;
      step: number;
      total_steps: number;
      message: string;
      details?: Record<string, unknown>;
    };

    // 스트리밍 토큰
    token: {
      type: 'token';
      task_id: string;
      token: string;
      is_final: boolean;
    };

    // 도구 호출 알림
    tool_call: {
      type: 'tool_call';
      task_id: string;
      tool_name: string;
      arguments: Record<string, unknown>;
      requires_approval: boolean;
    };

    // 승인 요청
    approval_required: {
      type: 'approval_required';
      task_id: string;
      action_id: string;
      action_type: string;
      description: string;
      risk_level: 'low' | 'medium' | 'high';
    };

    // 완료
    completed: {
      type: 'completed';
      task_id: string;
      result: unknown;
      usage: UsageMetrics;
    };

    // 에러
    error: {
      type: 'error';
      task_id: string;
      error_code: string;
      message: string;
      recoverable: boolean;
    };
  };
}
```

### 2.2 A2A 프로토콜 통합

에이전트 간 통신을 위한 A2A 프로토콜 구현:

```python
# a2a_integration.py
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from enum import Enum
import httpx
import json

class A2AMessageType(Enum):
    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    NEGOTIATION = "negotiation"

@dataclass
class AgentCard:
    """에이전트 신원 및 능력 카드"""
    id: str
    name: str
    version: str
    description: str
    capabilities: List[Dict[str, Any]]
    endpoint: str
    authentication: Dict[str, Any]
    sla: Dict[str, Any]

    @classmethod
    def from_url(cls, url: str) -> 'AgentCard':
        """원격 에이전트 카드 로드"""
        response = httpx.get(f"{url}/.well-known/agent-card.json")
        return cls(**response.json())

    def supports_capability(self, capability: str) -> bool:
        """특정 능력 지원 여부 확인"""
        return any(c['name'] == capability for c in self.capabilities)


class A2AClient:
    """A2A 프로토콜 클라이언트"""

    def __init__(self, my_agent_card: AgentCard):
        self.my_card = my_agent_card
        self.known_agents: Dict[str, AgentCard] = {}
        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def discover(self,
                      capability: str,
                      registry_url: Optional[str] = None) -> List[AgentCard]:
        """
        특정 능력을 가진 에이전트 발견

        Args:
            capability: 필요한 능력
            registry_url: 에이전트 레지스트리 URL

        Returns:
            매칭되는 에이전트 카드 목록
        """
        if registry_url:
            # 레지스트리에서 검색
            response = await self.http_client.get(
                f"{registry_url}/agents",
                params={"capability": capability}
            )
            agents = [AgentCard(**a) for a in response.json()]
        else:
            # 알려진 에이전트에서 검색
            agents = [
                card for card in self.known_agents.values()
                if card.supports_capability(capability)
            ]

        return agents

    async def request(self,
                     target: AgentCard,
                     action: str,
                     parameters: Dict[str, Any],
                     timeout: float = 60.0) -> Dict[str, Any]:
        """
        다른 에이전트에 작업 요청

        Args:
            target: 대상 에이전트 카드
            action: 요청할 액션
            parameters: 액션 파라미터
            timeout: 타임아웃 (초)

        Returns:
            응답 결과
        """
        message = {
            "header": {
                "message_id": self._generate_id(),
                "timestamp": self._now_iso(),
                "sender": {"id": self.my_card.id, "name": self.my_card.name},
                "receiver": {"id": target.id, "name": target.name},
                "message_type": A2AMessageType.REQUEST.value,
                "version": "1.0"
            },
            "body": {
                "action": action,
                "parameters": parameters
            },
            "security": {
                "signature": self._sign_message(message),
                "auth_token": await self._get_auth_token(target)
            }
        }

        response = await self.http_client.post(
            f"{target.endpoint}/a2a/messages",
            json=message,
            timeout=timeout
        )

        return response.json()["body"]["result"]

    async def delegate(self,
                      task: str,
                      context: Dict[str, Any]) -> Dict[str, Any]:
        """
        적절한 에이전트에게 작업 위임

        자동으로 적합한 에이전트를 찾아 위임
        """
        # 1. 작업 분석하여 필요한 능력 식별
        required_capability = await self._analyze_required_capability(task)

        # 2. 적합한 에이전트 발견
        candidates = await self.discover(required_capability)

        if not candidates:
            raise NoSuitableAgentError(
                f"No agent found for capability: {required_capability}"
            )

        # 3. 최적 에이전트 선택 (SLA, 비용 등 고려)
        best_agent = self._select_best_agent(candidates, context)

        # 4. 작업 위임
        result = await self.request(
            target=best_agent,
            action=required_capability,
            parameters={"task": task, "context": context}
        )

        return result


class A2AServer:
    """A2A 프로토콜 서버"""

    def __init__(self, agent_card: AgentCard):
        self.card = agent_card
        self.handlers: Dict[str, callable] = {}

    def handler(self, action: str):
        """액션 핸들러 데코레이터"""
        def decorator(func):
            self.handlers[action] = func
            return func
        return decorator

    async def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """수신 메시지 처리"""
        # 1. 메시지 검증
        if not self._verify_message(message):
            raise InvalidMessageError("Message verification failed")

        # 2. 핸들러 찾기
        action = message["body"]["action"]
        handler = self.handlers.get(action)

        if not handler:
            raise UnsupportedActionError(f"Action not supported: {action}")

        # 3. 핸들러 실행
        result = await handler(message["body"]["parameters"])

        # 4. 응답 생성
        return {
            "header": {
                "message_id": self._generate_id(),
                "correlation_id": message["header"]["message_id"],
                "timestamp": self._now_iso(),
                "sender": {"id": self.card.id},
                "receiver": message["header"]["sender"],
                "message_type": A2AMessageType.RESPONSE.value,
                "version": "1.0"
            },
            "body": {
                "result": result
            }
        }
```

---

## 3. 핵심 컴포넌트 설계

### 3.1 세션 관리자 (Session Manager)

![Session Management](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80)

*Figure 3: Session Management and State Handling*

```python
# session_manager.py
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import redis.asyncio as redis

class SessionState(Enum):
    CREATED = "created"
    ACTIVE = "active"
    WAITING_INPUT = "waiting_input"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"

@dataclass
class AgentSession:
    """에이전트 세션"""
    session_id: str
    user_id: str
    agent_id: str
    state: SessionState
    created_at: datetime
    updated_at: datetime
    expires_at: datetime

    # 세션 데이터
    context: Dict[str, Any] = field(default_factory=dict)
    memory: List[Dict[str, Any]] = field(default_factory=list)
    pending_actions: List[Dict[str, Any]] = field(default_factory=list)

    # 메트릭
    total_tokens: int = 0
    total_cost: float = 0.0
    tool_calls: int = 0


class SessionManager:
    """세션 관리자"""

    def __init__(self,
                 redis_url: str,
                 default_ttl: int = 3600,
                 max_sessions_per_user: int = 10):
        self.redis = redis.from_url(redis_url)
        self.default_ttl = default_ttl
        self.max_sessions_per_user = max_sessions_per_user

    async def create_session(self,
                            user_id: str,
                            agent_id: str,
                            initial_context: Optional[Dict] = None
                           ) -> AgentSession:
        """새 세션 생성"""
        # 사용자 세션 수 확인
        user_sessions = await self._get_user_sessions(user_id)
        if len(user_sessions) >= self.max_sessions_per_user:
            # 가장 오래된 세션 정리
            await self._cleanup_oldest_session(user_id)

        now = datetime.utcnow()
        session = AgentSession(
            session_id=self._generate_session_id(),
            user_id=user_id,
            agent_id=agent_id,
            state=SessionState.CREATED,
            created_at=now,
            updated_at=now,
            expires_at=now + timedelta(seconds=self.default_ttl),
            context=initial_context or {}
        )

        await self._save_session(session)
        return session

    async def get_session(self, session_id: str) -> Optional[AgentSession]:
        """세션 조회"""
        data = await self.redis.hgetall(f"session:{session_id}")
        if not data:
            return None

        session = self._deserialize_session(data)

        # 만료 확인
        if datetime.utcnow() > session.expires_at:
            await self.expire_session(session_id)
            return None

        return session

    async def update_session(self,
                            session_id: str,
                            updates: Dict[str, Any]) -> AgentSession:
        """세션 업데이트"""
        session = await self.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)

        # 업데이트 적용
        for key, value in updates.items():
            if hasattr(session, key):
                setattr(session, key, value)

        session.updated_at = datetime.utcnow()

        await self._save_session(session)
        return session

    async def add_to_memory(self,
                           session_id: str,
                           message: Dict[str, Any]) -> None:
        """세션 메모리에 메시지 추가"""
        session = await self.get_session(session_id)
        if not session:
            raise SessionNotFoundError(session_id)

        session.memory.append({
            **message,
            "timestamp": datetime.utcnow().isoformat()
        })

        # 메모리 크기 제한 (최근 100개 유지)
        if len(session.memory) > 100:
            session.memory = session.memory[-100:]

        await self._save_session(session)

    async def request_approval(self,
                              session_id: str,
                              action: Dict[str, Any]) -> str:
        """승인 요청 추가"""
        session = await self.get_session(session_id)

        action_id = self._generate_action_id()
        pending_action = {
            "action_id": action_id,
            "action": action,
            "requested_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }

        session.pending_actions.append(pending_action)
        session.state = SessionState.WAITING_APPROVAL

        await self._save_session(session)
        return action_id

    async def process_approval(self,
                              session_id: str,
                              action_id: str,
                              approved: bool,
                              feedback: Optional[str] = None) -> Dict:
        """승인 처리"""
        session = await self.get_session(session_id)

        for action in session.pending_actions:
            if action["action_id"] == action_id:
                action["status"] = "approved" if approved else "rejected"
                action["processed_at"] = datetime.utcnow().isoformat()
                action["feedback"] = feedback

                if not any(a["status"] == "pending"
                          for a in session.pending_actions):
                    session.state = SessionState.ACTIVE

                await self._save_session(session)
                return action

        raise ActionNotFoundError(action_id)
```

### 3.2 워크플로우 엔진 (Workflow Engine)

```python
# workflow_engine.py
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Callable
from enum import Enum
import asyncio

class NodeType(Enum):
    START = "start"
    END = "end"
    AGENT = "agent"
    TOOL = "tool"
    CONDITION = "condition"
    PARALLEL = "parallel"
    HUMAN_APPROVAL = "human_approval"
    WAIT = "wait"

@dataclass
class WorkflowNode:
    """워크플로우 노드"""
    id: str
    type: NodeType
    config: Dict[str, Any]
    next_nodes: List[str] = None
    condition: Optional[str] = None  # 조건부 분기용

@dataclass
class WorkflowDefinition:
    """워크플로우 정의"""
    id: str
    name: str
    version: str
    nodes: Dict[str, WorkflowNode]
    start_node: str


class WorkflowEngine:
    """워크플로우 실행 엔진"""

    def __init__(self,
                 agent_pool: 'AgentPool',
                 tool_registry: 'ToolRegistry',
                 session_manager: SessionManager):
        self.agent_pool = agent_pool
        self.tools = tool_registry
        self.sessions = session_manager
        self.node_executors: Dict[NodeType, Callable] = {
            NodeType.AGENT: self._execute_agent_node,
            NodeType.TOOL: self._execute_tool_node,
            NodeType.CONDITION: self._execute_condition_node,
            NodeType.PARALLEL: self._execute_parallel_node,
            NodeType.HUMAN_APPROVAL: self._execute_approval_node,
            NodeType.WAIT: self._execute_wait_node,
        }

    async def execute(self,
                     workflow: WorkflowDefinition,
                     session_id: str,
                     initial_input: Dict[str, Any]) -> Dict[str, Any]:
        """워크플로우 실행"""
        context = WorkflowContext(
            workflow_id=workflow.id,
            session_id=session_id,
            variables=initial_input,
            execution_path=[]
        )

        current_node_id = workflow.start_node

        while current_node_id:
            node = workflow.nodes[current_node_id]

            # 노드 실행
            result = await self._execute_node(node, context)

            # 실행 경로 기록
            context.execution_path.append({
                "node_id": current_node_id,
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            })

            # 다음 노드 결정
            current_node_id = await self._determine_next_node(
                node, result, context
            )

            # 종료 노드 체크
            if node.type == NodeType.END:
                break

        return {
            "status": "completed",
            "result": context.variables.get("final_result"),
            "execution_path": context.execution_path
        }

    async def _execute_node(self,
                           node: WorkflowNode,
                           context: 'WorkflowContext') -> Dict[str, Any]:
        """개별 노드 실행"""
        executor = self.node_executors.get(node.type)

        if not executor:
            raise UnsupportedNodeTypeError(node.type)

        return await executor(node, context)

    async def _execute_agent_node(self,
                                  node: WorkflowNode,
                                  context: 'WorkflowContext') -> Dict:
        """에이전트 노드 실행"""
        agent_id = node.config["agent_id"]
        task = self._render_template(node.config["task"], context.variables)

        agent = await self.agent_pool.acquire(agent_id)
        try:
            result = await agent.execute(
                task=task,
                context=context.variables,
                session_id=context.session_id
            )

            # 결과를 컨텍스트 변수에 저장
            output_var = node.config.get("output_variable", "agent_result")
            context.variables[output_var] = result

            return {"success": True, "result": result}

        finally:
            await self.agent_pool.release(agent)

    async def _execute_parallel_node(self,
                                     node: WorkflowNode,
                                     context: 'WorkflowContext') -> Dict:
        """병렬 실행 노드"""
        parallel_tasks = node.config["tasks"]

        async def execute_branch(branch_config):
            sub_workflow = WorkflowDefinition(**branch_config)
            return await self.execute(
                sub_workflow,
                context.session_id,
                context.variables.copy()
            )

        results = await asyncio.gather(
            *[execute_branch(task) for task in parallel_tasks],
            return_exceptions=True
        )

        # 결과 병합
        merged_results = {}
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                merged_results[f"branch_{i}"] = {"error": str(result)}
            else:
                merged_results[f"branch_{i}"] = result

        context.variables["parallel_results"] = merged_results
        return {"success": True, "results": merged_results}

    async def _execute_approval_node(self,
                                     node: WorkflowNode,
                                     context: 'WorkflowContext') -> Dict:
        """인간 승인 노드"""
        action_description = self._render_template(
            node.config["description"],
            context.variables
        )

        action_id = await self.sessions.request_approval(
            session_id=context.session_id,
            action={
                "type": node.config["action_type"],
                "description": action_description,
                "risk_level": node.config.get("risk_level", "medium"),
                "timeout": node.config.get("timeout", 3600)
            }
        )

        # 승인 대기
        timeout = node.config.get("timeout", 3600)
        start_time = asyncio.get_event_loop().time()

        while True:
            session = await self.sessions.get_session(context.session_id)

            for action in session.pending_actions:
                if action["action_id"] == action_id:
                    if action["status"] != "pending":
                        approved = action["status"] == "approved"
                        context.variables["approval_result"] = {
                            "approved": approved,
                            "feedback": action.get("feedback")
                        }
                        return {
                            "success": True,
                            "approved": approved
                        }

            # 타임아웃 체크
            if asyncio.get_event_loop().time() - start_time > timeout:
                return {
                    "success": False,
                    "error": "Approval timeout"
                }

            await asyncio.sleep(1)
```

---

## 4. 통합 패턴

### 4.1 MCP (Model Context Protocol) 통합

![MCP Integration](https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80)

*Figure 4: Model Context Protocol Integration*

```python
# mcp_integration.py
from dataclasses import dataclass
from typing import Dict, Any, List, Optional
import httpx

@dataclass
class MCPTool:
    """MCP 도구 정의"""
    name: str
    description: str
    input_schema: Dict[str, Any]
    server_url: str

@dataclass
class MCPResource:
    """MCP 리소스 정의"""
    uri: str
    name: str
    description: str
    mime_type: str


class MCPClient:
    """MCP 클라이언트"""

    def __init__(self):
        self.servers: Dict[str, 'MCPServerConnection'] = {}
        self.tools: Dict[str, MCPTool] = {}
        self.resources: Dict[str, MCPResource] = {}

    async def connect_server(self,
                            name: str,
                            url: str,
                            auth: Optional[Dict] = None) -> None:
        """MCP 서버 연결"""
        connection = MCPServerConnection(url, auth)
        await connection.initialize()

        self.servers[name] = connection

        # 도구 및 리소스 목록 로드
        tools = await connection.list_tools()
        for tool in tools:
            self.tools[tool.name] = tool

        resources = await connection.list_resources()
        for resource in resources:
            self.resources[resource.uri] = resource

    async def call_tool(self,
                       tool_name: str,
                       arguments: Dict[str, Any]) -> Any:
        """MCP 도구 호출"""
        tool = self.tools.get(tool_name)
        if not tool:
            raise ToolNotFoundError(tool_name)

        # 서버 찾기
        server = self._find_server_for_tool(tool)

        return await server.call_tool(tool_name, arguments)

    async def read_resource(self, uri: str) -> bytes:
        """MCP 리소스 읽기"""
        resource = self.resources.get(uri)
        if not resource:
            raise ResourceNotFoundError(uri)

        server = self._find_server_for_resource(resource)
        return await server.read_resource(uri)

    def get_tools_schema(self) -> List[Dict[str, Any]]:
        """LLM용 도구 스키마 반환"""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.input_schema
                }
            }
            for tool in self.tools.values()
        ]


class MCPServerConnection:
    """MCP 서버 연결"""

    def __init__(self, url: str, auth: Optional[Dict] = None):
        self.url = url
        self.auth = auth
        self.http = httpx.AsyncClient()
        self.capabilities = {}

    async def initialize(self) -> None:
        """서버 초기화 및 capability 협상"""
        response = await self.http.post(
            f"{self.url}/initialize",
            json={
                "protocolVersion": "1.0",
                "clientInfo": {
                    "name": "AgenticAIService",
                    "version": "1.0.0"
                }
            }
        )
        self.capabilities = response.json()["capabilities"]

    async def list_tools(self) -> List[MCPTool]:
        """사용 가능한 도구 목록"""
        response = await self.http.post(f"{self.url}/tools/list")
        return [MCPTool(**t, server_url=self.url)
                for t in response.json()["tools"]]

    async def call_tool(self,
                       name: str,
                       arguments: Dict[str, Any]) -> Any:
        """도구 호출"""
        response = await self.http.post(
            f"{self.url}/tools/call",
            json={"name": name, "arguments": arguments}
        )
        return response.json()["result"]
```

### 4.2 LLM Provider 추상화

```python
# llm_provider.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, AsyncIterator
from enum import Enum

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    LOCAL = "local"

@dataclass
class LLMResponse:
    """LLM 응답"""
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    usage: Optional[Dict[str, int]] = None
    finish_reason: str = "stop"
    model: str = ""


class BaseLLMClient(ABC):
    """LLM 클라이언트 기본 클래스"""

    @abstractmethod
    async def generate(self,
                      messages: List[Dict[str, Any]],
                      tools: Optional[List[Dict]] = None,
                      **kwargs) -> LLMResponse:
        """텍스트 생성"""
        pass

    @abstractmethod
    async def stream(self,
                    messages: List[Dict[str, Any]],
                    tools: Optional[List[Dict]] = None,
                    **kwargs) -> AsyncIterator[str]:
        """스트리밍 생성"""
        pass


class LLMRouter:
    """
    LLM 라우터

    요청 특성에 따라 적절한 모델 선택
    """

    def __init__(self):
        self.providers: Dict[str, BaseLLMClient] = {}
        self.routing_rules: List[RoutingRule] = []
        self.fallback_provider: str = "openai"

    def register_provider(self,
                         name: str,
                         client: BaseLLMClient) -> None:
        """프로바이더 등록"""
        self.providers[name] = client

    def add_routing_rule(self, rule: 'RoutingRule') -> None:
        """라우팅 규칙 추가"""
        self.routing_rules.append(rule)

    async def route(self,
                   messages: List[Dict[str, Any]],
                   context: Dict[str, Any]) -> BaseLLMClient:
        """
        요청을 적절한 프로바이더로 라우팅

        고려 사항:
        - 작업 복잡도
        - 비용 제약
        - 지연 시간 요구사항
        - 특수 기능 필요 여부 (vision, function calling 등)
        """
        for rule in self.routing_rules:
            if rule.matches(messages, context):
                provider_name = rule.get_provider()
                if provider_name in self.providers:
                    return self.providers[provider_name]

        return self.providers[self.fallback_provider]

    async def generate_with_fallback(self,
                                    messages: List[Dict[str, Any]],
                                    context: Dict[str, Any],
                                    **kwargs) -> LLMResponse:
        """폴백을 포함한 생성"""
        provider = await self.route(messages, context)

        try:
            return await provider.generate(messages, **kwargs)
        except Exception as e:
            # 폴백 시도
            fallback = self.providers[self.fallback_provider]
            if fallback != provider:
                return await fallback.generate(messages, **kwargs)
            raise


@dataclass
class RoutingRule:
    """라우팅 규칙"""
    name: str
    conditions: Dict[str, Any]
    provider: str
    priority: int = 0

    def matches(self,
               messages: List[Dict],
               context: Dict) -> bool:
        """조건 매칭 확인"""
        # 복잡도 기반
        if "max_complexity" in self.conditions:
            complexity = self._estimate_complexity(messages)
            if complexity > self.conditions["max_complexity"]:
                return False

        # 비용 제약
        if "max_cost_per_request" in self.conditions:
            if context.get("budget_remaining", float('inf')) < \
               self.conditions["max_cost_per_request"]:
                return False

        # 기능 요구사항
        if "required_features" in self.conditions:
            for feature in self.conditions["required_features"]:
                if feature in ["vision", "function_calling"]:
                    if not self._provider_supports(self.provider, feature):
                        return False

        return True

    def get_provider(self) -> str:
        return self.provider
```

---

## 5. 보안 및 거버넌스

### 5.1 보안 아키텍처

![Security Architecture](https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80)

*Figure 5: Security Architecture for AI Services*

```python
# security.py
from dataclasses import dataclass
from typing import Dict, Any, List, Optional
from enum import Enum
import re
import hashlib

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class SecurityPolicy:
    """보안 정책"""
    name: str
    enabled: bool
    risk_level: RiskLevel
    rules: List[Dict[str, Any]]


class SecurityGuardrails:
    """
    보안 가드레일

    입력/출력 검증, 위험 행동 차단
    """

    def __init__(self):
        self.input_validators: List['InputValidator'] = []
        self.output_validators: List['OutputValidator'] = []
        self.action_policies: List[SecurityPolicy] = []

        # 기본 검증기 설정
        self._setup_default_validators()

    def _setup_default_validators(self):
        """기본 검증기 설정"""
        # PII 검출기
        self.input_validators.append(PIIDetector())
        self.output_validators.append(PIIDetector())

        # 인젝션 공격 검출
        self.input_validators.append(InjectionDetector())

        # 유해 콘텐츠 필터
        self.output_validators.append(HarmfulContentFilter())

    async def validate_input(self,
                            input_data: Dict[str, Any],
                            context: Dict[str, Any]) -> 'ValidationResult':
        """입력 검증"""
        issues = []

        for validator in self.input_validators:
            result = await validator.validate(input_data, context)
            if not result.valid:
                issues.extend(result.issues)

        return ValidationResult(
            valid=len(issues) == 0,
            issues=issues,
            risk_level=self._calculate_risk_level(issues)
        )

    async def validate_output(self,
                             output: str,
                             context: Dict[str, Any]) -> 'ValidationResult':
        """출력 검증"""
        issues = []

        for validator in self.output_validators:
            result = await validator.validate(output, context)
            if not result.valid:
                issues.extend(result.issues)

        return ValidationResult(
            valid=len(issues) == 0,
            issues=issues,
            sanitized_output=self._sanitize_output(output, issues)
        )

    async def check_action(self,
                          action: Dict[str, Any],
                          context: Dict[str, Any]) -> 'ActionCheckResult':
        """액션 실행 전 검사"""
        for policy in self.action_policies:
            if not policy.enabled:
                continue

            for rule in policy.rules:
                if self._action_matches_rule(action, rule):
                    return ActionCheckResult(
                        allowed=rule.get("allow", False),
                        requires_approval=rule.get("requires_approval", True),
                        risk_level=policy.risk_level,
                        reason=rule.get("message", "Policy violation")
                    )

        # 기본: 허용
        return ActionCheckResult(allowed=True, requires_approval=False)

    def _sanitize_output(self,
                        output: str,
                        issues: List['ValidationIssue']) -> str:
        """출력 정제"""
        sanitized = output

        for issue in issues:
            if issue.type == "pii" and issue.matches:
                for match in issue.matches:
                    sanitized = sanitized.replace(match, "[REDACTED]")

        return sanitized


class PIIDetector:
    """개인정보 검출기"""

    PII_PATTERNS = {
        "korean_id": r'\d{6}-[1-4]\d{6}',
        "phone": r'01[0-9]-?\d{4}-?\d{4}',
        "email": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        "credit_card": r'\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}',
        "ip_address": r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',
    }

    async def validate(self,
                       data: Any,
                       context: Dict) -> 'ValidationResult':
        text = str(data)
        matches = []

        for pii_type, pattern in self.PII_PATTERNS.items():
            found = re.findall(pattern, text)
            if found:
                matches.extend([
                    {"type": pii_type, "value": m} for m in found
                ])

        if matches:
            return ValidationResult(
                valid=False,
                issues=[ValidationIssue(
                    type="pii",
                    severity="high",
                    message=f"PII detected: {len(matches)} instances",
                    matches=[m["value"] for m in matches]
                )]
            )

        return ValidationResult(valid=True)


class InjectionDetector:
    """인젝션 공격 검출기"""

    INJECTION_PATTERNS = [
        # Prompt injection
        r'ignore\s+(previous|above|all)\s+instructions',
        r'disregard\s+.*\s+instructions',
        r'you\s+are\s+now\s+',
        r'new\s+instructions:',
        # Jailbreak attempts
        r'DAN\s+mode',
        r'developer\s+mode',
        r'pretend\s+you',
    ]

    async def validate(self,
                       data: Any,
                       context: Dict) -> 'ValidationResult':
        text = str(data).lower()

        for pattern in self.INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return ValidationResult(
                    valid=False,
                    issues=[ValidationIssue(
                        type="injection",
                        severity="critical",
                        message="Potential injection attack detected"
                    )]
                )

        return ValidationResult(valid=True)
```

---

## 6. 배포 및 운영

### 6.1 프로덕션 체크리스트

배포 전 반드시 확인해야 할 항목들:

```markdown
## Pre-deployment Checklist

### Security
- [ ] 모든 API 엔드포인트에 인증/인가 적용
- [ ] Rate limiting 설정
- [ ] Input validation 활성화
- [ ] Output sanitization 활성화
- [ ] PII 검출 및 마스킹
- [ ] 감사 로깅 활성화
- [ ] Secrets 관리 (환경 변수, Vault 등)

### Reliability
- [ ] Health check 엔드포인트
- [ ] Circuit breaker 패턴 적용
- [ ] Retry with exponential backoff
- [ ] Graceful shutdown 처리
- [ ] 타임아웃 설정

### Observability
- [ ] 분산 추적 (OpenTelemetry)
- [ ] 메트릭 수집 (Prometheus)
- [ ] 구조화된 로깅
- [ ] 알림 설정 (PagerDuty, Slack)
- [ ] 대시보드 구성

### Cost Management
- [ ] 토큰 사용량 모니터링
- [ ] 비용 알림 설정
- [ ] 캐싱 전략
- [ ] 모델 라우팅 최적화

### Compliance
- [ ] 데이터 보존 정책
- [ ] GDPR/개인정보보호법 준수
- [ ] 사용 약관 고지
- [ ] AI 사용 공개
```

### 6.2 모니터링 대시보드

```yaml
# grafana-dashboard.yaml
apiVersion: 1
providers:
  - name: 'AgentOps'
    type: file
    options:
      path: /var/lib/grafana/dashboards

dashboards:
  - name: "Agentic AI Service"
    panels:
      # 요청 메트릭
      - title: "Request Rate"
        type: graph
        gridPos: {x: 0, y: 0, w: 8, h: 6}
        targets:
          - expr: rate(agent_requests_total[5m])

      - title: "Latency (p99)"
        type: graph
        gridPos: {x: 8, y: 0, w: 8, h: 6}
        targets:
          - expr: histogram_quantile(0.99, rate(agent_request_duration_bucket[5m]))

      - title: "Error Rate"
        type: gauge
        gridPos: {x: 16, y: 0, w: 8, h: 6}
        targets:
          - expr: sum(rate(agent_errors_total[5m])) / sum(rate(agent_requests_total[5m]))

      # 비용 메트릭
      - title: "Hourly Cost"
        type: stat
        gridPos: {x: 0, y: 6, w: 6, h: 4}
        targets:
          - expr: increase(agent_cost_dollars[1h])

      - title: "Token Usage"
        type: graph
        gridPos: {x: 6, y: 6, w: 10, h: 4}
        targets:
          - expr: rate(agent_tokens_total[5m])

      # 에이전트 상태
      - title: "Active Sessions"
        type: stat
        gridPos: {x: 0, y: 10, w: 6, h: 4}
        targets:
          - expr: agent_active_sessions

      - title: "Pending Approvals"
        type: stat
        gridPos: {x: 6, y: 10, w: 6, h: 4}
        targets:
          - expr: agent_pending_approvals
```

---

## 7. 결론 및 권장사항

### 7.1 설계 시 핵심 고려사항

1. **안전성 우선**: 가드레일과 인간 승인 루프는 선택이 아닌 필수
2. **관찰 가능성**: 처음부터 추적, 메트릭, 로깅 설계
3. **비용 인식**: 토큰 예산과 모델 라우팅으로 비용 최적화
4. **확장성**: 상태 비저장 설계와 수평적 확장
5. **표준 준수**: A2A, MCP 등 표준 프로토콜 채택

### 7.2 다음 단계

- [**아키텍처 패턴**](/docs/architecture/patterns): 세부 설계 패턴
- [**AgentOps**](/docs/agentops/overview): 운영 가이드
- [**실전 사례**](/docs/practical/case-studies): 구현 예제

---

## 참고 자료

1. Google A2A Protocol Specification
2. Anthropic Model Context Protocol
3. OpenTelemetry Semantic Conventions for LLM
4. OWASP Top 10 for LLM Applications
