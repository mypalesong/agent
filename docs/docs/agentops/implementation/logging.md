---
sidebar_position: 3
title: "구조화 로깅"
description: "AI 에이전트를 위한 구조화 로깅 시스템 구현"
---

# 구조화 로깅 구현 가이드

AI 에이전트의 행동과 추론 과정을 추적하기 위한 구조화 로깅 시스템을 구축하는 방법을 설명합니다.

---

## 1. 에이전트 로깅 요구사항

### 1.1 기존 로깅과의 차이

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Agent Logging Requirements                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Traditional Application Logs       Agent-Specific Logs                  │
│  ─────────────────────────────      ──────────────────────               │
│                                                                          │
│  • HTTP requests/responses          • Reasoning chains (CoT)             │
│  • Database queries                 • LLM prompts & completions          │
│  • Error stack traces               • Tool selection rationale           │
│  • User actions                     • Memory retrievals                  │
│  • System events                    • Decision confidence scores         │
│                                     • Inter-agent communications         │
│                                     • Guardrail evaluations              │
│                                     • Token usage per step               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 로그 레벨 정의

| Level | 용도 | 예시 |
|-------|------|------|
| **DEBUG** | 상세 디버깅 정보 | 전체 프롬프트, 메모리 검색 결과 |
| **INFO** | 정상 작업 흐름 | 요청 시작/완료, 도구 호출 |
| **WARNING** | 잠재적 문제 | 재시도, 가드레일 경고 |
| **ERROR** | 오류 발생 | API 실패, 도구 오류 |
| **CRITICAL** | 심각한 장애 | 에이전트 중단, 보안 위반 |

---

## 2. 로그 스키마 정의

### 2.1 기본 로그 스키마

```python
# agentops/logging/schema.py

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum
import json

class LogCategory(str, Enum):
    """로그 카테고리"""
    LIFECYCLE = "agent.lifecycle"       # 시작, 종료, 상태 변경
    REQUEST = "agent.request"           # 요청 처리
    LLM = "agent.llm"                  # LLM 호출
    TOOL = "agent.tool"                # 도구 호출
    REASONING = "agent.reasoning"       # 추론 과정
    MEMORY = "agent.memory"            # 메모리 접근
    A2A = "agent.a2a"                  # 에이전트 간 통신
    GUARDRAIL = "agent.guardrail"      # 가드레일
    EVALUATION = "agent.evaluation"    # 평가
    ERROR = "agent.error"              # 에러
    SECURITY = "agent.security"        # 보안 이벤트

@dataclass
class AgentLogRecord:
    """
    에이전트 로그 레코드 스키마

    모든 에이전트 로그는 이 스키마를 따름
    """

    # 필수 필드
    timestamp: str
    level: str
    category: LogCategory
    message: str

    # 에이전트 식별
    agent_id: str = ""
    agent_name: str = ""
    agent_version: str = ""

    # 컨텍스트 식별
    session_id: str = ""
    request_id: str = ""
    trace_id: str = ""
    span_id: str = ""
    user_id: Optional[str] = None

    # 상세 데이터
    data: Dict[str, Any] = field(default_factory=dict)

    # 에러 정보 (ERROR 레벨일 때)
    error: Optional[Dict[str, Any]] = None

    # 메타데이터
    environment: str = ""
    hostname: str = ""
    service: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "category": self.category.value if isinstance(self.category, LogCategory) else self.category,
            "message": self.message,
            "agent": {
                "id": self.agent_id,
                "name": self.agent_name,
                "version": self.agent_version
            },
            "context": {
                "session_id": self.session_id,
                "request_id": self.request_id,
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "user_id": self.user_id
            },
            "data": self.data,
            "error": self.error,
            "meta": {
                "environment": self.environment,
                "hostname": self.hostname,
                "service": self.service
            }
        }

    def to_json(self) -> str:
        """JSON 문자열로 변환"""
        return json.dumps(self.to_dict(), default=str, ensure_ascii=False)
```

### 2.2 특수 로그 타입

```python
# agentops/logging/types.py

@dataclass
class LLMLogData:
    """LLM 호출 로그 데이터"""
    model: str
    provider: str
    prompt_summary: str  # 프롬프트 요약 (전체는 DEBUG)
    completion_summary: str  # 응답 요약
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    duration_ms: float
    cost_usd: float
    temperature: Optional[float] = None
    finish_reason: Optional[str] = None

@dataclass
class ToolLogData:
    """도구 호출 로그 데이터"""
    tool_name: str
    tool_category: str
    input_summary: str
    output_summary: str
    duration_ms: float
    status: str  # success, error
    error_message: Optional[str] = None

@dataclass
class ReasoningLogData:
    """추론 로그 데이터"""
    step: str
    thought: str
    action: str
    confidence: Optional[float] = None
    alternatives_considered: Optional[List[str]] = None

@dataclass
class GuardrailLogData:
    """가드레일 로그 데이터"""
    guardrail_type: str
    direction: str  # input, output
    result: str  # pass, block, warn
    reason: Optional[str] = None
    content_snippet: Optional[str] = None  # 문제가 된 내용 일부

@dataclass
class ErrorLogData:
    """에러 로그 데이터"""
    error_type: str
    error_message: str
    stack_trace: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)
    recoverable: bool = True
```

---

## 3. 로거 구현

### 3.1 에이전트 로거

```python
# agentops/logging/logger.py

import structlog
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from opentelemetry import trace
import os
import socket

class AgentLogger:
    """
    구조화된 에이전트 로거
    """

    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        agent_version: str,
        log_level: str = "INFO",
        log_format: str = "json"  # json or console
    ):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.agent_version = agent_version
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.hostname = socket.gethostname()
        self.service = os.getenv("SERVICE_NAME", agent_name)

        self._setup_structlog(log_level, log_format)

    def _setup_structlog(self, log_level: str, log_format: str):
        """structlog 설정"""
        processors = [
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            self._add_context,
        ]

        if log_format == "json":
            processors.append(structlog.processors.JSONRenderer())
        else:
            processors.append(structlog.dev.ConsoleRenderer(colors=True))

        structlog.configure(
            processors=processors,
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
        )

        # 로그 레벨 설정
        logging.basicConfig(
            format="%(message)s",
            level=getattr(logging, log_level.upper())
        )

        self.logger = structlog.get_logger()

    def _add_context(self, logger, method_name, event_dict):
        """트레이스 컨텍스트 자동 추가"""
        span = trace.get_current_span()
        if span:
            ctx = span.get_span_context()
            event_dict["trace_id"] = format(ctx.trace_id, '032x')
            event_dict["span_id"] = format(ctx.span_id, '016x')

        event_dict["agent"] = {
            "id": self.agent_id,
            "name": self.agent_name,
            "version": self.agent_version
        }
        event_dict["meta"] = {
            "environment": self.environment,
            "hostname": self.hostname,
            "service": self.service
        }

        return event_dict

    def _create_record(
        self,
        level: str,
        category: LogCategory,
        message: str,
        **kwargs
    ) -> AgentLogRecord:
        """로그 레코드 생성"""
        span = trace.get_current_span()
        trace_id = ""
        span_id = ""
        if span:
            ctx = span.get_span_context()
            trace_id = format(ctx.trace_id, '032x')
            span_id = format(ctx.span_id, '016x')

        return AgentLogRecord(
            timestamp=datetime.utcnow().isoformat(),
            level=level,
            category=category,
            message=message,
            agent_id=self.agent_id,
            agent_name=self.agent_name,
            agent_version=self.agent_version,
            trace_id=trace_id,
            span_id=span_id,
            environment=self.environment,
            hostname=self.hostname,
            service=self.service,
            **kwargs
        )

    # ==================== Lifecycle Logs ====================

    def log_agent_started(self, config: Dict[str, Any] = None):
        """에이전트 시작 로그"""
        self.logger.info(
            "Agent started",
            category=LogCategory.LIFECYCLE.value,
            config=config or {}
        )

    def log_agent_stopped(self, reason: str = "normal"):
        """에이전트 종료 로그"""
        self.logger.info(
            "Agent stopped",
            category=LogCategory.LIFECYCLE.value,
            reason=reason
        )

    # ==================== Request Logs ====================

    def log_request_start(
        self,
        request_id: str,
        session_id: str,
        action: str,
        user_id: str = None,
        input_summary: str = None
    ):
        """요청 시작 로그"""
        self.logger.info(
            f"Request started: {action}",
            category=LogCategory.REQUEST.value,
            request_id=request_id,
            session_id=session_id,
            user_id=user_id,
            action=action,
            input_summary=input_summary[:200] if input_summary else None
        )

    def log_request_complete(
        self,
        request_id: str,
        action: str,
        duration_ms: float,
        status: str,
        output_summary: str = None
    ):
        """요청 완료 로그"""
        self.logger.info(
            f"Request completed: {action}",
            category=LogCategory.REQUEST.value,
            request_id=request_id,
            action=action,
            duration_ms=duration_ms,
            status=status,
            output_summary=output_summary[:200] if output_summary else None
        )

    # ==================== LLM Logs ====================

    def log_llm_call(
        self,
        model: str,
        provider: str,
        prompt_summary: str,
        completion_summary: str,
        prompt_tokens: int,
        completion_tokens: int,
        duration_ms: float,
        cost_usd: float,
        finish_reason: str = None
    ):
        """LLM 호출 로그"""
        self.logger.info(
            f"LLM call: {provider}/{model}",
            category=LogCategory.LLM.value,
            model=model,
            provider=provider,
            prompt_summary=prompt_summary[:200],
            completion_summary=completion_summary[:200],
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            duration_ms=duration_ms,
            cost_usd=cost_usd,
            finish_reason=finish_reason
        )

    def log_llm_prompt_debug(
        self,
        model: str,
        full_prompt: str
    ):
        """LLM 프롬프트 상세 로그 (DEBUG)"""
        self.logger.debug(
            f"LLM prompt for {model}",
            category=LogCategory.LLM.value,
            model=model,
            full_prompt=full_prompt
        )

    # ==================== Tool Logs ====================

    def log_tool_call(
        self,
        tool_name: str,
        tool_category: str,
        input_data: Dict,
        output_data: Any,
        duration_ms: float,
        status: str
    ):
        """도구 호출 로그"""
        self.logger.info(
            f"Tool call: {tool_name}",
            category=LogCategory.TOOL.value,
            tool_name=tool_name,
            tool_category=tool_category,
            input_summary=self._summarize(input_data, 200),
            output_summary=self._summarize(output_data, 200),
            duration_ms=duration_ms,
            status=status
        )

    # ==================== Reasoning Logs ====================

    def log_reasoning(
        self,
        step: str,
        thought: str,
        action: str,
        confidence: float = None
    ):
        """추론 과정 로그"""
        self.logger.info(
            f"Reasoning: {step}",
            category=LogCategory.REASONING.value,
            step=step,
            thought=thought[:500],
            action=action,
            confidence=confidence
        )

    def log_decision(
        self,
        decision: str,
        reason: str,
        alternatives: List[str] = None
    ):
        """의사 결정 로그"""
        self.logger.info(
            f"Decision made: {decision}",
            category=LogCategory.REASONING.value,
            decision=decision,
            reason=reason,
            alternatives=alternatives
        )

    # ==================== Guardrail Logs ====================

    def log_guardrail_check(
        self,
        guardrail_type: str,
        direction: str,
        result: str,
        reason: str = None
    ):
        """가드레일 검사 로그"""
        level = "info" if result == "pass" else "warning"
        getattr(self.logger, level)(
            f"Guardrail {direction}: {guardrail_type}",
            category=LogCategory.GUARDRAIL.value,
            guardrail_type=guardrail_type,
            direction=direction,
            result=result,
            reason=reason
        )

    def log_guardrail_block(
        self,
        guardrail_type: str,
        direction: str,
        reason: str,
        content_snippet: str = None
    ):
        """가드레일 차단 로그"""
        self.logger.warning(
            f"Guardrail blocked: {guardrail_type}",
            category=LogCategory.GUARDRAIL.value,
            guardrail_type=guardrail_type,
            direction=direction,
            result="block",
            reason=reason,
            content_snippet=content_snippet[:100] if content_snippet else None
        )

    # ==================== Error Logs ====================

    def log_error(
        self,
        error: Exception,
        context: Dict[str, Any] = None,
        recoverable: bool = True
    ):
        """에러 로그"""
        import traceback

        self.logger.error(
            str(error),
            category=LogCategory.ERROR.value,
            error_type=type(error).__name__,
            error_message=str(error),
            stack_trace=traceback.format_exc(),
            context=context or {},
            recoverable=recoverable
        )

    def log_critical(
        self,
        message: str,
        error: Exception = None,
        context: Dict[str, Any] = None
    ):
        """치명적 에러 로그"""
        import traceback

        self.logger.critical(
            message,
            category=LogCategory.ERROR.value,
            error_type=type(error).__name__ if error else None,
            error_message=str(error) if error else None,
            stack_trace=traceback.format_exc() if error else None,
            context=context or {}
        )

    # ==================== Security Logs ====================

    def log_security_event(
        self,
        event_type: str,
        severity: str,
        description: str,
        details: Dict[str, Any] = None
    ):
        """보안 이벤트 로그"""
        self.logger.warning(
            f"Security event: {event_type}",
            category=LogCategory.SECURITY.value,
            event_type=event_type,
            severity=severity,
            description=description,
            details=details or {}
        )

    # ==================== Utilities ====================

    def _summarize(self, data: Any, max_length: int) -> str:
        """데이터 요약"""
        try:
            if isinstance(data, str):
                return data[:max_length]
            return json.dumps(data, default=str, ensure_ascii=False)[:max_length]
        except:
            return str(data)[:max_length]

    def _sanitize(self, data: Dict) -> Dict:
        """민감 정보 마스킹"""
        sensitive_keys = ["password", "api_key", "token", "secret", "credential", "ssn", "credit_card"]
        sanitized = {}

        for key, value in data.items():
            if any(s in key.lower() for s in sensitive_keys):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize(value)
            else:
                sanitized[key] = value

        return sanitized
```

---

## 4. 로그 수집 및 저장

### 4.1 Fluentd 설정

```yaml
# fluent.conf

<source>
  @type forward
  port 24224
  bind 0.0.0.0
</source>

# 에이전트 로그 파싱
<filter agent.**>
  @type parser
  key_name log
  <parse>
    @type json
    time_key timestamp
    time_format %Y-%m-%dT%H:%M:%S
  </parse>
</filter>

# 민감 정보 마스킹
<filter agent.**>
  @type record_transformer
  enable_ruby true
  <record>
    data ${record["data"].to_s.gsub(/password[^,}]*/, 'password: [REDACTED]')}
  </record>
</filter>

# Elasticsearch로 전송
<match agent.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name agentops-logs
  type_name _doc

  <buffer>
    @type file
    path /var/log/fluent/buffer/agent
    flush_interval 5s
    chunk_limit_size 10m
    retry_max_interval 30
    retry_forever true
  </buffer>
</match>

# Loki로 전송
<match agent.**>
  @type loki
  url "http://loki:3100"

  <label>
    agent $.agent.name
    category $.category
    level $.level
    environment $.meta.environment
  </label>

  <buffer>
    @type file
    path /var/log/fluent/buffer/loki
    flush_interval 3s
  </buffer>
</match>
```

### 4.2 Loki 쿼리 예시

```logql
# 특정 에이전트의 에러 로그
{agent="travel-booking-agent", level="error"}

# 최근 1시간 내 가드레일 차단 로그
{category="agent.guardrail"} |= "block" | json | __error__="" | line_format "{{.guardrail_type}}: {{.reason}}"

# 특정 세션의 전체 로그
{session_id="sess_abc123"} | json

# LLM 호출 비용 분석
{category="agent.llm"} | json | cost_usd > 0.01

# 높은 지연시간 요청 찾기
{category="agent.request"} |= "completed" | json | duration_ms > 5000
```

---

## 5. 다음 단계

- [평가 시스템](./evaluation) - 품질 평가 파이프라인
- [감사 로깅](../security/audit) - 보안 감사 로깅
- [비용 최적화](../best-practices/cost-optimization) - 로깅 비용 관리
