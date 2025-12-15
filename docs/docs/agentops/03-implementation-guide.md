---
sidebar_position: 3
title: 실전 구현 가이드
description: AgentOps 시스템을 처음부터 끝까지 구현하는 단계별 가이드
---

# AgentOps 실전 구현 가이드

이 가이드에서는 LangGraph를 사용하여 프로덕션 레벨의 AgentOps 시스템을 단계별로 구현합니다.

## 프로젝트 구조

```
agentops-system/
├── src/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py              # 기본 에이전트 클래스
│   │   ├── supervisor.py        # 슈퍼바이저 에이전트
│   │   ├── researcher.py        # 리서처 에이전트
│   │   ├── coder.py             # 코더 에이전트
│   │   └── writer.py            # 작가 에이전트
│   ├── core/
│   │   ├── __init__.py
│   │   ├── state.py             # 상태 정의
│   │   ├── graph.py             # 그래프 빌더
│   │   └── config.py            # 설정
│   ├── guardrails/
│   │   ├── __init__.py
│   │   ├── input.py             # 입력 검증
│   │   ├── output.py            # 출력 검증
│   │   └── policies.py          # 정책 정의
│   ├── observability/
│   │   ├── __init__.py
│   │   ├── metrics.py           # 메트릭 수집
│   │   ├── tracing.py           # 분산 추적
│   │   └── logging.py           # 로깅
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── search.py            # 검색 도구
│   │   ├── code.py              # 코드 실행 도구
│   │   └── file.py              # 파일 처리 도구
│   └── main.py                  # 엔트리포인트
├── tests/
│   ├── unit/
│   ├── integration/
│   └── evaluation/
├── config/
│   ├── development.yaml
│   ├── staging.yaml
│   └── production.yaml
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── k8s/
│   ├── deployment.yaml
│   └── service.yaml
├── requirements.txt
├── pyproject.toml
└── README.md
```

## Step 1: 환경 설정

### 의존성 설치

```bash
# 프로젝트 디렉토리 생성
mkdir agentops-system && cd agentops-system

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install langgraph langchain-openai langchain-core
pip install prometheus-client opentelemetry-api opentelemetry-sdk
pip install redis psycopg2-binary pydantic pyyaml
pip install pytest pytest-asyncio httpx
```

### requirements.txt

```txt
# Core
langgraph>=0.2.0
langchain-openai>=0.2.0
langchain-core>=0.3.0

# Observability
prometheus-client>=0.20.0
opentelemetry-api>=1.24.0
opentelemetry-sdk>=1.24.0
opentelemetry-exporter-otlp>=1.24.0

# Storage
redis>=5.0.0
psycopg2-binary>=2.9.0

# Utils
pydantic>=2.0.0
pyyaml>=6.0.0
python-dotenv>=1.0.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

### 설정 파일

```python
# src/core/config.py
from pydantic import BaseSettings
from typing import Literal
import os

class Settings(BaseSettings):
    """AgentOps 설정"""

    # 환경
    environment: Literal["development", "staging", "production"] = "development"

    # LLM 설정
    openai_api_key: str
    default_model: str = "gpt-4o-mini"
    max_tokens: int = 4096
    temperature: float = 0.7

    # 체크포인터 설정
    checkpoint_type: Literal["memory", "postgres", "redis"] = "memory"
    postgres_url: str = ""
    redis_url: str = ""

    # 메트릭 설정
    metrics_enabled: bool = True
    metrics_port: int = 9090

    # 추적 설정
    tracing_enabled: bool = True
    otlp_endpoint: str = "http://localhost:4317"
    langsmith_api_key: str = ""

    # 가드레일 설정
    guardrails_enabled: bool = True
    max_cost_per_request: float = 1.0
    max_tokens_per_request: int = 100000

    # 로깅 설정
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "json"

    class Config:
        env_file = ".env"
        env_prefix = "AGENTOPS_"


settings = Settings()
```

## Step 2: 상태 정의

```python
# src/core/state.py
from typing import TypedDict, Annotated, Literal, Optional, Any
from langgraph.graph.message import add_messages
from dataclasses import dataclass, field
from datetime import datetime
import uuid

@dataclass
class TokenUsage:
    """토큰 사용량"""
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class OperationalMetrics:
    """운영 메트릭"""
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None

    # 토큰 & 비용
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost: float = 0.0

    # 호출 횟수
    llm_calls: int = 0
    tool_calls: int = 0
    agent_switches: int = 0

    # 에러
    errors: list = field(default_factory=list)

    # 레이턴시
    latencies: dict = field(default_factory=dict)

    def add_token_usage(self, usage: TokenUsage):
        """토큰 사용량 추가"""
        self.total_input_tokens += usage.input_tokens
        self.total_output_tokens += usage.output_tokens
        self.llm_calls += 1

        # 비용 계산
        cost = self._calculate_cost(usage)
        self.total_cost += cost

    def _calculate_cost(self, usage: TokenUsage) -> float:
        """비용 계산"""
        pricing = {
            "gpt-4o": {"input": 2.5, "output": 10.0},
            "gpt-4o-mini": {"input": 0.15, "output": 0.6},
            "gpt-4-turbo": {"input": 10.0, "output": 30.0},
            "claude-3-5-sonnet": {"input": 3.0, "output": 15.0},
            "claude-3-haiku": {"input": 0.25, "output": 1.25},
        }

        rates = pricing.get(usage.model, {"input": 1.0, "output": 2.0})
        return (
            (usage.input_tokens / 1_000_000) * rates["input"] +
            (usage.output_tokens / 1_000_000) * rates["output"]
        )


@dataclass
class TraceContext:
    """분산 추적 컨텍스트"""
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    span_id: str = ""
    parent_span_id: str = ""
    baggage: dict = field(default_factory=dict)


@dataclass
class GuardrailResult:
    """가드레일 검사 결과"""
    passed: bool = True
    violations: list = field(default_factory=list)
    risk_level: Literal["low", "medium", "high", "critical"] = "low"
    requires_approval: bool = False
    approval_reason: str = ""


class AgentOpsState(TypedDict):
    """AgentOps 메인 상태"""

    # === 대화 상태 ===
    messages: Annotated[list, add_messages]

    # === 라우팅 상태 ===
    current_agent: str
    next_agent: str
    completed_agents: list[str]
    iteration_count: int

    # === 운영 메트릭 ===
    metrics: OperationalMetrics
    trace: TraceContext

    # === 가드레일 ===
    guardrail: GuardrailResult
    approved: Optional[bool]

    # === 세션 정보 ===
    session_id: str
    user_id: str
    environment: Literal["development", "staging", "production"]

    # === 임시 데이터 ===
    working_memory: dict[str, Any]
```

## Step 3: 도구 구현

```python
# src/tools/search.py
from langchain_core.tools import tool
from typing import Optional
import httpx

@tool
async def web_search(query: str, num_results: int = 5) -> str:
    """
    웹 검색을 수행합니다.

    Args:
        query: 검색할 쿼리
        num_results: 반환할 결과 수

    Returns:
        검색 결과 요약
    """
    # 실제 구현에서는 검색 API 사용 (SerpAPI, Tavily 등)
    # 여기서는 예시 응답
    return f"'{query}'에 대한 검색 결과 {num_results}개를 찾았습니다..."


@tool
async def fetch_webpage(url: str) -> str:
    """
    웹페이지 내용을 가져옵니다.

    Args:
        url: 가져올 URL

    Returns:
        웹페이지 내용 (텍스트)
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30.0)
        return response.text[:5000]  # 최대 5000자


# src/tools/code.py
@tool
async def execute_python(code: str) -> str:
    """
    Python 코드를 실행합니다.

    Args:
        code: 실행할 Python 코드

    Returns:
        실행 결과 또는 에러 메시지
    """
    import sys
    from io import StringIO

    old_stdout = sys.stdout
    sys.stdout = StringIO()

    try:
        exec(code, {"__builtins__": __builtins__})
        output = sys.stdout.getvalue()
        return output if output else "코드가 성공적으로 실행되었습니다."
    except Exception as e:
        return f"실행 에러: {str(e)}"
    finally:
        sys.stdout = old_stdout


@tool
def analyze_code(code: str, language: str = "python") -> str:
    """
    코드를 분석합니다.

    Args:
        code: 분석할 코드
        language: 프로그래밍 언어

    Returns:
        코드 분석 결과
    """
    # 기본 분석 (실제로는 AST 파싱 등 사용)
    lines = code.strip().split('\n')
    return f"""
코드 분석 결과:
- 언어: {language}
- 총 라인 수: {len(lines)}
- 빈 라인: {sum(1 for l in lines if not l.strip())}
- 주석 라인: {sum(1 for l in lines if l.strip().startswith('#'))}
"""


# src/tools/file.py
@tool
async def read_file(path: str) -> str:
    """
    파일 내용을 읽습니다.

    Args:
        path: 파일 경로

    Returns:
        파일 내용
    """
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return f"파일을 찾을 수 없습니다: {path}"
    except Exception as e:
        return f"파일 읽기 에러: {str(e)}"


@tool
async def write_file(path: str, content: str) -> str:
    """
    파일에 내용을 씁니다.

    Args:
        path: 파일 경로
        content: 작성할 내용

    Returns:
        결과 메시지
    """
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"파일이 성공적으로 작성되었습니다: {path}"
    except Exception as e:
        return f"파일 쓰기 에러: {str(e)}"


@tool
async def list_directory(path: str = ".") -> str:
    """
    디렉토리 내용을 나열합니다.

    Args:
        path: 디렉토리 경로

    Returns:
        디렉토리 내용 목록
    """
    import os
    try:
        items = os.listdir(path)
        return "\n".join(items)
    except Exception as e:
        return f"디렉토리 읽기 에러: {str(e)}"
```

## Step 4: 가드레일 구현

```python
# src/guardrails/input.py
import re
from dataclasses import dataclass
from typing import Optional
from ..core.state import GuardrailResult

class InputValidator:
    """입력 검증기"""

    # PII 패턴
    PII_PATTERNS = {
        "korean_ssn": (r'\b\d{6}-[1-4]\d{6}\b', "주민등록번호"),
        "phone_kr": (r'\b01[0-9]-?\d{4}-?\d{4}\b', "전화번호"),
        "email": (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', "이메일"),
        "credit_card": (r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', "신용카드"),
        "passport": (r'\b[A-Z]{1,2}\d{7,8}\b', "여권번호"),
    }

    # 위험 명령어 패턴
    DANGEROUS_PATTERNS = [
        (r'\b(rm|del(ete)?)\s+(-rf?|--force)?\s*[/\\]', "위험한 삭제 명령"),
        (r'\b(sudo|su)\s+', "권한 상승 시도"),
        (r'\bchmod\s+777\b', "위험한 권한 설정"),
        (r'\b(DROP|DELETE|TRUNCATE)\s+(TABLE|DATABASE)\b', "위험한 SQL"),
    ]

    # 프롬프트 인젝션 패턴
    INJECTION_PATTERNS = [
        (r'ignore\s+(previous|all|above)\s+instructions?', "프롬프트 인젝션"),
        (r'you\s+are\s+now\s+', "역할 변경 시도"),
        (r'pretend\s+(to\s+be|you\'?re)', "역할 변경 시도"),
        (r'system\s*:\s*', "시스템 프롬프트 주입"),
    ]

    @classmethod
    def validate(cls, text: str) -> GuardrailResult:
        """입력 검증 수행"""
        violations = []
        risk_level = "low"

        # PII 검사
        for pattern_name, (pattern, description) in cls.PII_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"PII 감지: {description}")
                risk_level = "high"

        # 위험 명령어 검사
        for pattern, description in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"위험 패턴: {description}")
                risk_level = "critical"

        # 프롬프트 인젝션 검사
        for pattern, description in cls.INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"보안 위협: {description}")
                risk_level = "critical"

        # 결과 반환
        passed = len(violations) == 0
        requires_approval = risk_level in ["high", "critical"]

        return GuardrailResult(
            passed=passed,
            violations=violations,
            risk_level=risk_level,
            requires_approval=requires_approval,
            approval_reason="; ".join(violations) if violations else ""
        )


# src/guardrails/output.py
class OutputValidator:
    """출력 검증기"""

    @classmethod
    def validate(cls, text: str) -> GuardrailResult:
        """출력 검증 수행"""
        violations = []

        # PII 유출 검사
        for pattern_name, (pattern, description) in InputValidator.PII_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"PII 유출 위험: {description}")

        # 민감 정보 패턴
        sensitive_patterns = [
            (r'api[_-]?key\s*[:=]\s*[\'"]?\w+', "API 키 노출"),
            (r'password\s*[:=]\s*[\'"]?\w+', "비밀번호 노출"),
            (r'secret\s*[:=]\s*[\'"]?\w+', "시크릿 노출"),
        ]

        for pattern, description in sensitive_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(description)

        return GuardrailResult(
            passed=len(violations) == 0,
            violations=violations,
            risk_level="high" if violations else "low"
        )

    @classmethod
    def sanitize(cls, text: str) -> str:
        """민감 정보 마스킹"""
        # PII 마스킹
        for pattern_name, (pattern, _) in InputValidator.PII_PATTERNS.items():
            text = re.sub(pattern, "[REDACTED]", text, flags=re.IGNORECASE)

        # 비밀 정보 마스킹
        text = re.sub(
            r'(api[_-]?key|password|secret)\s*[:=]\s*[\'"]?\w+[\'"]?',
            r'\1=[REDACTED]',
            text,
            flags=re.IGNORECASE
        )

        return text


# src/guardrails/policies.py
from ..core.state import AgentOpsState, OperationalMetrics

class PolicyEngine:
    """정책 엔진"""

    @classmethod
    def check_budget(cls, state: AgentOpsState, max_cost: float = 1.0) -> bool:
        """예산 정책 검사"""
        metrics = state.get("metrics", OperationalMetrics())
        return metrics.total_cost < max_cost

    @classmethod
    def check_iteration_limit(cls, state: AgentOpsState, max_iterations: int = 10) -> bool:
        """반복 제한 정책 검사"""
        return state.get("iteration_count", 0) < max_iterations

    @classmethod
    def check_token_limit(cls, state: AgentOpsState, max_tokens: int = 100000) -> bool:
        """토큰 제한 정책 검사"""
        metrics = state.get("metrics", OperationalMetrics())
        total_tokens = metrics.total_input_tokens + metrics.total_output_tokens
        return total_tokens < max_tokens

    @classmethod
    def enforce_all(cls, state: AgentOpsState) -> tuple[bool, list[str]]:
        """모든 정책 검사"""
        violations = []

        if not cls.check_budget(state):
            violations.append("예산 초과")

        if not cls.check_iteration_limit(state):
            violations.append("반복 횟수 초과")

        if not cls.check_token_limit(state):
            violations.append("토큰 한도 초과")

        return len(violations) == 0, violations
```

## Step 5: 에이전트 구현

```python
# src/agents/base.py
from abc import ABC, abstractmethod
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

from ..core.state import AgentOpsState, TokenUsage

class BaseAgent(ABC):
    """기본 에이전트 클래스"""

    def __init__(
        self,
        name: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        tools: list = None
    ):
        self.name = name
        self.model = model
        self.tools = tools or []

        self.llm = ChatOpenAI(
            model=model,
            temperature=temperature
        )

        if self.tools:
            self.llm = self.llm.bind_tools(self.tools)

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """시스템 프롬프트"""
        pass

    async def __call__(self, state: AgentOpsState) -> dict:
        """에이전트 실행"""
        messages = [
            SystemMessage(content=self.system_prompt),
            *state["messages"]
        ]

        response = await self.llm.ainvoke(messages)

        # 토큰 사용량 추적
        usage = TokenUsage(
            model=self.model,
            input_tokens=response.usage_metadata.get("input_tokens", 0),
            output_tokens=response.usage_metadata.get("output_tokens", 0)
        )

        # 메트릭 업데이트
        metrics = state.get("metrics")
        if metrics:
            metrics.add_token_usage(usage)

        return {
            "messages": [response],
            "current_agent": self.name,
            "metrics": metrics,
        }


# src/agents/supervisor.py
from .base import BaseAgent
from ..core.state import AgentOpsState

class SupervisorAgent(BaseAgent):
    """슈퍼바이저 에이전트"""

    def __init__(self):
        super().__init__(
            name="supervisor",
            model="gpt-4o-mini",
            temperature=0
        )

    @property
    def system_prompt(self) -> str:
        return """당신은 AI 에이전트 팀의 슈퍼바이저입니다.

## 역할
사용자 요청을 분석하고 적절한 전문 에이전트에게 작업을 위임합니다.

## 사용 가능한 에이전트
- researcher: 정보 검색, 리서치, 데이터 수집
- coder: 코드 작성, 디버깅, 기술 구현
- writer: 문서 작성, 콘텐츠 생성, 편집

## 규칙
1. 요청의 핵심 의도를 파악합니다
2. 가장 적합한 에이전트를 선택합니다
3. 작업이 완료되면 FINISH를 선택합니다

## 응답 형식
반드시 다음 형식으로 응답하세요:
NEXT: [researcher|coder|writer|FINISH]
REASON: [선택 이유]
TASK: [에이전트에게 전달할 작업 설명]"""

    async def __call__(self, state: AgentOpsState) -> dict:
        result = await super().__call__(state)

        # 응답 파싱
        content = result["messages"][-1].content.lower()

        if "next: researcher" in content:
            next_agent = "researcher"
        elif "next: coder" in content:
            next_agent = "coder"
        elif "next: writer" in content:
            next_agent = "writer"
        else:
            next_agent = "FINISH"

        result["next_agent"] = next_agent
        result["iteration_count"] = state.get("iteration_count", 0) + 1

        return result


# src/agents/researcher.py
from .base import BaseAgent
from ..tools.search import web_search, fetch_webpage

class ResearcherAgent(BaseAgent):
    """리서처 에이전트"""

    def __init__(self):
        super().__init__(
            name="researcher",
            model="gpt-4o-mini",
            temperature=0.5,
            tools=[web_search, fetch_webpage]
        )

    @property
    def system_prompt(self) -> str:
        return """당신은 전문 리서처입니다.

## 역할
- 정보를 검색하고 수집합니다
- 데이터를 분석하고 정리합니다
- 신뢰할 수 있는 출처를 확인합니다

## 규칙
1. 검색 도구를 적극 활용합니다
2. 여러 출처를 교차 검증합니다
3. 핵심 정보를 구조화하여 전달합니다

## 출력 형식
- 발견한 핵심 정보
- 출처 및 신뢰도
- 추가 조사 필요 사항"""


# src/agents/coder.py
from .base import BaseAgent
from ..tools.code import execute_python, analyze_code
from ..tools.file import read_file, write_file

class CoderAgent(BaseAgent):
    """코더 에이전트"""

    def __init__(self):
        super().__init__(
            name="coder",
            model="gpt-4o",  # 코딩은 더 강력한 모델
            temperature=0.3,
            tools=[execute_python, analyze_code, read_file, write_file]
        )

    @property
    def system_prompt(self) -> str:
        return """당신은 전문 소프트웨어 개발자입니다.

## 역할
- 코드를 작성하고 리뷰합니다
- 버그를 디버깅합니다
- 최적화와 리팩토링을 수행합니다

## 규칙
1. 깔끔하고 읽기 쉬운 코드를 작성합니다
2. 주석과 문서화를 포함합니다
3. 에러 처리를 고려합니다
4. 보안 취약점을 피합니다

## 출력 형식
- 코드 (적절한 언어로)
- 설명 및 사용법
- 주의사항"""


# src/agents/writer.py
from .base import BaseAgent
from ..tools.file import read_file, write_file

class WriterAgent(BaseAgent):
    """작가 에이전트"""

    def __init__(self):
        super().__init__(
            name="writer",
            model="gpt-4o-mini",
            temperature=0.7,
            tools=[read_file, write_file]
        )

    @property
    def system_prompt(self) -> str:
        return """당신은 전문 테크니컬 라이터입니다.

## 역할
- 문서를 작성하고 편집합니다
- 기술 콘텐츠를 명확하게 설명합니다
- 다양한 형식의 문서를 생성합니다

## 규칙
1. 명확하고 간결한 문체를 사용합니다
2. 대상 독자를 고려합니다
3. 구조화된 형식을 사용합니다

## 출력 형식
- 마크다운 형식 권장
- 적절한 헤딩 구조
- 예시 포함"""
```

## Step 6: 그래프 구성

```python
# src/core/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.prebuilt import ToolNode

from .state import AgentOpsState, GuardrailResult, OperationalMetrics
from .config import settings
from ..agents.supervisor import SupervisorAgent
from ..agents.researcher import ResearcherAgent
from ..agents.coder import CoderAgent
from ..agents.writer import WriterAgent
from ..guardrails.input import InputValidator
from ..guardrails.output import OutputValidator
from ..guardrails.policies import PolicyEngine
from ..tools.search import web_search, fetch_webpage
from ..tools.code import execute_python, analyze_code
from ..tools.file import read_file, write_file, list_directory


# 에이전트 인스턴스
supervisor = SupervisorAgent()
researcher = ResearcherAgent()
coder = CoderAgent()
writer = WriterAgent()

# 도구 노드
all_tools = [
    web_search, fetch_webpage,
    execute_python, analyze_code,
    read_file, write_file, list_directory
]
tools_node = ToolNode(all_tools)


# === 노드 함수 ===

async def input_guardrail_node(state: AgentOpsState) -> dict:
    """입력 가드레일"""
    last_message = state["messages"][-1].content
    result = InputValidator.validate(last_message)
    return {"guardrail": result}


async def output_guardrail_node(state: AgentOpsState) -> dict:
    """출력 가드레일"""
    last_message = state["messages"][-1].content
    result = OutputValidator.validate(last_message)

    if not result.passed:
        # 위반 시 출력 마스킹
        sanitized = OutputValidator.sanitize(last_message)
        return {
            "messages": [{"role": "assistant", "content": sanitized}],
            "guardrail": result
        }

    return {"guardrail": result}


async def supervisor_node(state: AgentOpsState) -> dict:
    """슈퍼바이저 노드"""
    return await supervisor(state)


async def researcher_node(state: AgentOpsState) -> dict:
    """리서처 노드"""
    result = await researcher(state)
    result["completed_agents"] = state.get("completed_agents", []) + ["researcher"]
    return result


async def coder_node(state: AgentOpsState) -> dict:
    """코더 노드"""
    result = await coder(state)
    result["completed_agents"] = state.get("completed_agents", []) + ["coder"]
    return result


async def writer_node(state: AgentOpsState) -> dict:
    """작가 노드"""
    result = await writer(state)
    result["completed_agents"] = state.get("completed_agents", []) + ["writer"]
    return result


async def approval_node(state: AgentOpsState) -> dict:
    """승인 대기 노드 (패스스루)"""
    return {}


async def finalize_node(state: AgentOpsState) -> dict:
    """최종화 노드"""
    from datetime import datetime

    metrics = state.get("metrics", OperationalMetrics())
    metrics.end_time = datetime.now()

    return {"metrics": metrics}


# === 라우팅 함수 ===

def route_after_input_guardrail(state: AgentOpsState) -> str:
    """입력 가드레일 후 라우팅"""
    guardrail = state.get("guardrail", GuardrailResult())

    if guardrail.requires_approval:
        return "approval"

    if not guardrail.passed:
        return "reject"

    return "supervisor"


def route_after_supervisor(state: AgentOpsState) -> str:
    """슈퍼바이저 후 라우팅"""
    # 정책 검사
    passed, violations = PolicyEngine.enforce_all(state)
    if not passed:
        return "policy_violation"

    # 승인 대기 확인
    guardrail = state.get("guardrail", GuardrailResult())
    if guardrail.requires_approval and not state.get("approved"):
        return "approval"

    # 다음 에이전트로 라우팅
    next_agent = state.get("next_agent", "FINISH")
    return next_agent


def route_after_agent(state: AgentOpsState) -> str:
    """전문 에이전트 후 라우팅"""
    last_message = state["messages"][-1]

    # 도구 호출이 있으면 도구 노드로
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    # 아니면 슈퍼바이저로
    return "supervisor"


def route_after_tools(state: AgentOpsState) -> str:
    """도구 실행 후 라우팅"""
    return state.get("current_agent", "supervisor")


# === 그래프 빌더 ===

def build_graph(checkpointer=None):
    """AgentOps 그래프 빌드"""

    builder = StateGraph(AgentOpsState)

    # 노드 추가
    builder.add_node("input_guardrail", input_guardrail_node)
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("writer", writer_node)
    builder.add_node("tools", tools_node)
    builder.add_node("approval", approval_node)
    builder.add_node("output_guardrail", output_guardrail_node)
    builder.add_node("finalize", finalize_node)

    # 시작 → 입력 가드레일
    builder.add_edge(START, "input_guardrail")

    # 입력 가드레일 라우팅
    builder.add_conditional_edges(
        "input_guardrail",
        route_after_input_guardrail,
        {
            "supervisor": "supervisor",
            "approval": "approval",
            "reject": "output_guardrail",
        }
    )

    # 승인 → 슈퍼바이저
    builder.add_edge("approval", "supervisor")

    # 슈퍼바이저 라우팅
    builder.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "researcher": "researcher",
            "coder": "coder",
            "writer": "writer",
            "FINISH": "output_guardrail",
            "approval": "approval",
            "policy_violation": "output_guardrail",
        }
    )

    # 전문 에이전트 라우팅
    for agent in ["researcher", "coder", "writer"]:
        builder.add_conditional_edges(
            agent,
            route_after_agent,
            {"tools": "tools", "supervisor": "supervisor"}
        )

    # 도구 → 에이전트로 복귀
    builder.add_conditional_edges(
        "tools",
        route_after_tools,
        {
            "researcher": "researcher",
            "coder": "coder",
            "writer": "writer",
            "supervisor": "supervisor",
        }
    )

    # 출력 가드레일 → 최종화
    builder.add_edge("output_guardrail", "finalize")

    # 최종화 → 종료
    builder.add_edge("finalize", END)

    # 체크포인터 설정
    if checkpointer is None:
        checkpointer = MemorySaver()

    # 컴파일 (승인 노드에서 인터럽트)
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["approval"]
    )


# 그래프 인스턴스 생성
graph = build_graph()
```

## Step 7: 실행 및 테스트

```python
# src/main.py
import asyncio
from datetime import datetime
from core.graph import graph
from core.state import AgentOpsState, OperationalMetrics, TraceContext


async def run_agent(user_message: str, session_id: str = None):
    """에이전트 실행"""

    session_id = session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    config = {
        "configurable": {
            "thread_id": session_id
        }
    }

    initial_state = {
        "messages": [{"role": "user", "content": user_message}],
        "current_agent": "",
        "next_agent": "",
        "completed_agents": [],
        "iteration_count": 0,
        "metrics": OperationalMetrics(),
        "trace": TraceContext(),
        "session_id": session_id,
        "user_id": "user_001",
        "environment": "development",
        "working_memory": {},
    }

    print(f"\n{'='*60}")
    print(f"세션 ID: {session_id}")
    print(f"사용자 입력: {user_message}")
    print(f"{'='*60}\n")

    # 실행
    result = await graph.ainvoke(initial_state, config=config)

    # 결과 출력
    print(f"\n{'='*60}")
    print("실행 완료!")
    print(f"{'='*60}")
    print(f"\n최종 응답:")
    print(result["messages"][-1].content)

    print(f"\n운영 메트릭:")
    metrics = result.get("metrics", OperationalMetrics())
    print(f"  - 총 입력 토큰: {metrics.total_input_tokens:,}")
    print(f"  - 총 출력 토큰: {metrics.total_output_tokens:,}")
    print(f"  - 총 비용: ${metrics.total_cost:.4f}")
    print(f"  - LLM 호출 횟수: {metrics.llm_calls}")
    print(f"  - 도구 호출 횟수: {metrics.tool_calls}")
    print(f"  - 에러 수: {len(metrics.errors)}")

    print(f"\n실행된 에이전트: {result.get('completed_agents', [])}")

    return result


async def run_with_streaming(user_message: str, session_id: str = None):
    """스트리밍 실행"""

    session_id = session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    config = {"configurable": {"thread_id": session_id}}

    initial_state = {
        "messages": [{"role": "user", "content": user_message}],
        "current_agent": "",
        "next_agent": "",
        "completed_agents": [],
        "iteration_count": 0,
        "metrics": OperationalMetrics(),
        "trace": TraceContext(),
        "session_id": session_id,
        "user_id": "user_001",
        "environment": "development",
        "working_memory": {},
    }

    print(f"\n{'='*60}")
    print(f"스트리밍 실행 시작")
    print(f"{'='*60}\n")

    async for event in graph.astream_events(initial_state, config=config, version="v2"):
        kind = event["event"]

        if kind == "on_chain_start":
            node_name = event.get("name", "unknown")
            if node_name not in ["RunnableSequence", "ChannelWrite"]:
                print(f"🔄 {node_name} 시작...")

        elif kind == "on_chain_end":
            node_name = event.get("name", "unknown")
            if node_name not in ["RunnableSequence", "ChannelWrite"]:
                print(f"✅ {node_name} 완료")

        elif kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                print(content, end="", flush=True)

        elif kind == "on_tool_start":
            print(f"\n🔧 도구 시작: {event['name']}")

        elif kind == "on_tool_end":
            print(f"🔧 도구 완료: {event['name']}")


# 실행
if __name__ == "__main__":
    # 기본 실행
    asyncio.run(run_agent("파이썬으로 피보나치 수열 계산하는 함수 만들어줘"))

    # 스트리밍 실행
    # asyncio.run(run_with_streaming("최신 AI 트렌드 조사해줘"))
```

## 다음 단계

- [코드 템플릿](./04-templates.md): 복사해서 바로 사용할 수 있는 템플릿
- [프로덕션 배포](./05-deployment.md): Kubernetes, Docker 배포 가이드
- [고급 패턴](./06-advanced-patterns.md): 복잡한 워크플로우 구현
