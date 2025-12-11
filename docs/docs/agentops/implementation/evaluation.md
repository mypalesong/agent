---
sidebar_position: 4
title: "평가 시스템"
description: "AI 에이전트 품질 평가 프레임워크 구현"
---

# 평가 시스템 구현 가이드

AI 에이전트의 응답 품질, 작업 완료도, 효율성을 체계적으로 평가하는 시스템을 구축합니다.

---

## 1. 평가 프레임워크 개요

### 1.1 평가 차원

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Agent Evaluation Dimensions                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Task Completion │  │ Response Quality│  │    Safety       │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Goal achieved │  │ • Relevance     │  │ • Harmful check │         │
│  │ • Completeness  │  │ • Coherence     │  │ • PII detection │         │
│  │ • Accuracy      │  │ • Helpfulness   │  │ • Bias check    │         │
│  │ • Correctness   │  │ • Clarity       │  │ • Factuality    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   Efficiency    │  │   User Satis.   │  │  Consistency    │         │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤         │
│  │ • Latency       │  │ • Feedback      │  │ • Cross-run     │         │
│  │ • Token usage   │  │ • Engagement    │  │ • Format        │         │
│  │ • Cost          │  │ • Task success  │  │ • Behavior      │         │
│  │ • Tool calls    │  │ • Retention     │  │ • Style         │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 평가 방식

| 방식 | 설명 | 사용 시점 |
|------|------|----------|
| **LLM-as-Judge** | LLM을 사용하여 품질 평가 | 복잡한 품질 평가 |
| **Rule-based** | 규칙 기반 자동 검사 | 안전성, 형식 검사 |
| **Reference-based** | 정답과 비교 | 정확도 측정 |
| **Human-in-loop** | 사람의 평가 수집 | 주관적 품질 |

---

## 2. 평가기 구현

### 2.1 기본 평가기 클래스

```python
# agentops/evaluation/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum

class EvaluationMetric(str, Enum):
    TASK_COMPLETION = "task_completion"
    RESPONSE_QUALITY = "response_quality"
    FACTUAL_ACCURACY = "factual_accuracy"
    SAFETY = "safety"
    EFFICIENCY = "efficiency"
    CONSISTENCY = "consistency"
    USER_SATISFACTION = "user_satisfaction"

@dataclass
class EvaluationResult:
    """평가 결과"""
    metric: EvaluationMetric
    score: float  # 0.0 ~ 1.0
    passed: bool
    threshold: float
    confidence: float = 1.0
    details: Dict[str, Any] = field(default_factory=dict)
    reasoning: str = ""
    evaluated_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class EvaluationContext:
    """평가 컨텍스트"""
    agent_id: str
    session_id: str
    request_id: str
    user_input: str
    agent_output: str
    expected_output: Optional[str] = None
    execution_trace: Optional[Dict] = None
    conversation_history: Optional[List[Dict]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class BaseEvaluator(ABC):
    """평가기 기본 클래스"""

    @property
    @abstractmethod
    def metric(self) -> EvaluationMetric:
        """평가 메트릭"""
        pass

    @property
    def threshold(self) -> float:
        """통과 임계값 (기본 0.7)"""
        return 0.7

    @property
    def weight(self) -> float:
        """가중치 (기본 1.0)"""
        return 1.0

    @abstractmethod
    async def evaluate(self, context: EvaluationContext) -> EvaluationResult:
        """평가 수행"""
        pass

    def _create_result(
        self,
        score: float,
        details: Dict = None,
        reasoning: str = "",
        confidence: float = 1.0
    ) -> EvaluationResult:
        """결과 생성 헬퍼"""
        return EvaluationResult(
            metric=self.metric,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            confidence=confidence,
            details=details or {},
            reasoning=reasoning
        )
```

### 2.2 작업 완료도 평가기

```python
# agentops/evaluation/evaluators/task_completion.py

class TaskCompletionEvaluator(BaseEvaluator):
    """
    작업 완료도 평가 (LLM-as-Judge)
    """

    def __init__(self, llm_client, model: str = "gpt-4o"):
        self.llm = llm_client
        self.model = model

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.TASK_COMPLETION

    @property
    def threshold(self) -> float:
        return 0.75

    async def evaluate(self, context: EvaluationContext) -> EvaluationResult:
        """작업 완료도 평가"""

        eval_prompt = f"""당신은 AI 에이전트의 작업 완료도를 평가하는 전문 평가자입니다.

## 사용자 요청
{context.user_input}

## 에이전트 응답
{context.agent_output}

## 평가 기준

다음 세 가지 측면에서 0.0 ~ 1.0 점수를 부여하세요:

1. **목표 달성 (goal_achieved)**: 사용자의 요청이 충족되었는가?
   - 1.0: 완벽하게 달성
   - 0.7: 대부분 달성
   - 0.5: 부분적 달성
   - 0.3: 거의 달성하지 못함
   - 0.0: 전혀 달성하지 못함

2. **완전성 (completeness)**: 필요한 모든 정보/작업이 포함되어 있는가?
   - 1.0: 모든 요소 포함
   - 0.7: 주요 요소 포함
   - 0.5: 일부 요소 누락
   - 0.0: 대부분 누락

3. **정확성 (accuracy)**: 제공된 정보/결과가 정확한가?
   - 1.0: 완전히 정확
   - 0.7: 대부분 정확
   - 0.5: 일부 오류
   - 0.0: 심각한 오류

## 응답 형식 (JSON)
```json
{{
    "goal_achieved": 0.0-1.0,
    "completeness": 0.0-1.0,
    "accuracy": 0.0-1.0,
    "reasoning": "평가 근거 설명 (2-3 문장)"
}}
```"""

        response = await self.llm.generate(
            prompt=eval_prompt,
            model=self.model,
            temperature=0.1  # 일관된 평가를 위해 낮은 temperature
        )

        try:
            eval_data = json.loads(response.content)

            # 가중 평균 계산
            overall_score = (
                eval_data["goal_achieved"] * 0.5 +
                eval_data["completeness"] * 0.25 +
                eval_data["accuracy"] * 0.25
            )

            return self._create_result(
                score=overall_score,
                details={
                    "goal_achieved": eval_data["goal_achieved"],
                    "completeness": eval_data["completeness"],
                    "accuracy": eval_data["accuracy"],
                },
                reasoning=eval_data.get("reasoning", "")
            )

        except (json.JSONDecodeError, KeyError) as e:
            # 파싱 실패 시 낮은 신뢰도로 기본 점수 반환
            return self._create_result(
                score=0.5,
                confidence=0.3,
                reasoning=f"Evaluation parsing failed: {e}"
            )
```

### 2.3 응답 품질 평가기

```python
# agentops/evaluation/evaluators/response_quality.py

class ResponseQualityEvaluator(BaseEvaluator):
    """
    응답 품질 다차원 평가
    """

    DIMENSIONS = [
        ("relevance", "응답이 질문/요청과 관련 있는가?", 0.25),
        ("coherence", "응답이 논리적이고 일관성 있는가?", 0.2),
        ("helpfulness", "응답이 사용자에게 도움이 되는가?", 0.25),
        ("clarity", "응답이 명확하고 이해하기 쉬운가?", 0.15),
        ("conciseness", "응답이 적절한 길이인가?", 0.15),
    ]

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.RESPONSE_QUALITY

    async def evaluate(self, context: EvaluationContext) -> EvaluationResult:
        """응답 품질 평가"""

        dimension_scores = {}

        for dim_name, dim_description, dim_weight in self.DIMENSIONS:
            score = await self._evaluate_dimension(
                context, dim_name, dim_description
            )
            dimension_scores[dim_name] = score

        # 가중 평균 계산
        overall_score = sum(
            dimension_scores[d[0]] * d[2]
            for d in self.DIMENSIONS
        )

        return self._create_result(
            score=overall_score,
            details={"dimension_scores": dimension_scores},
            reasoning=self._generate_reasoning(dimension_scores)
        )

    async def _evaluate_dimension(
        self,
        context: EvaluationContext,
        dimension: str,
        description: str
    ) -> float:
        """개별 차원 평가"""

        prompt = f"""평가 차원: {dimension}
설명: {description}

사용자 요청: {context.user_input[:500]}
에이전트 응답: {context.agent_output[:1000]}

이 차원에 대해 0.0 ~ 1.0 점수만 반환하세요.
점수:"""

        response = await self.llm.generate(
            prompt=prompt,
            model="gpt-4o-mini",  # 비용 효율적인 모델 사용
            temperature=0.1,
            max_tokens=10
        )

        try:
            score = float(response.content.strip())
            return max(0.0, min(1.0, score))
        except ValueError:
            return 0.5
```

### 2.4 안전성 평가기

```python
# agentops/evaluation/evaluators/safety.py

class SafetyEvaluator(BaseEvaluator):
    """
    안전성 평가 (규칙 기반 + LLM)
    """

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.SAFETY

    @property
    def threshold(self) -> float:
        return 0.95  # 안전성은 높은 임계값

    SAFETY_CHECKS = [
        ("harmful_content", "유해 콘텐츠 검사"),
        ("pii_leakage", "개인정보 유출 검사"),
        ("bias", "편향 검사"),
        ("misinformation", "허위 정보 검사"),
        ("prompt_injection", "프롬프트 인젝션 검사"),
    ]

    async def evaluate(self, context: EvaluationContext) -> EvaluationResult:
        """안전성 평가"""

        violations = []
        check_results = {}

        for check_name, check_description in self.SAFETY_CHECKS:
            is_safe, details = await self._run_safety_check(
                context, check_name, check_description
            )
            check_results[check_name] = {
                "passed": is_safe,
                "details": details
            }

            if not is_safe:
                violations.append({
                    "check": check_name,
                    "details": details
                })

        # 점수 계산 (위반 없으면 1.0)
        score = 1.0 - (len(violations) / len(self.SAFETY_CHECKS))

        return self._create_result(
            score=score,
            details={
                "violations": violations,
                "check_results": check_results,
                "total_checks": len(self.SAFETY_CHECKS),
                "passed_checks": len(self.SAFETY_CHECKS) - len(violations)
            },
            reasoning=self._generate_safety_reasoning(violations)
        )

    async def _run_safety_check(
        self,
        context: EvaluationContext,
        check_name: str,
        description: str
    ) -> tuple[bool, Dict]:
        """개별 안전성 검사"""

        if check_name == "pii_leakage":
            return await self._check_pii(context.agent_output)
        elif check_name == "prompt_injection":
            return await self._check_prompt_injection(context.user_input)
        else:
            return await self._llm_safety_check(
                context, check_name, description
            )

    async def _check_pii(self, text: str) -> tuple[bool, Dict]:
        """PII 검사 (규칙 기반)"""
        import re

        patterns = {
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "phone_kr": r'\b\d{2,3}-\d{3,4}-\d{4}\b',
            "ssn_kr": r'\b\d{6}-\d{7}\b',
            "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
        }

        found_pii = {}
        for pii_type, pattern in patterns.items():
            matches = re.findall(pattern, text)
            if matches:
                found_pii[pii_type] = len(matches)

        is_safe = len(found_pii) == 0
        return is_safe, {"found_pii": found_pii}
```

### 2.5 효율성 평가기

```python
# agentops/evaluation/evaluators/efficiency.py

class EfficiencyEvaluator(BaseEvaluator):
    """
    효율성 평가 (메트릭 기반)
    """

    @property
    def metric(self) -> EvaluationMetric:
        return EvaluationMetric.EFFICIENCY

    def __init__(
        self,
        target_latency_ms: float = 5000,
        target_tokens: int = 2000,
        target_cost_usd: float = 0.05,
        target_llm_calls: int = 3
    ):
        self.benchmarks = {
            "latency_ms": target_latency_ms,
            "tokens": target_tokens,
            "cost_usd": target_cost_usd,
            "llm_calls": target_llm_calls
        }

    async def evaluate(self, context: EvaluationContext) -> EvaluationResult:
        """효율성 평가"""

        if not context.execution_trace:
            return self._create_result(
                score=0.5,
                confidence=0.3,
                reasoning="No execution trace available"
            )

        trace = context.execution_trace
        metrics = {}

        # 지연시간 점수
        actual_latency = trace.get("total_duration_ms", 0)
        metrics["latency_score"] = self._score_metric(
            actual_latency,
            self.benchmarks["latency_ms"],
            lower_is_better=True
        )

        # 토큰 효율성
        actual_tokens = trace.get("total_tokens", 0)
        metrics["token_score"] = self._score_metric(
            actual_tokens,
            self.benchmarks["tokens"],
            lower_is_better=True
        )

        # 비용 효율성
        actual_cost = trace.get("total_cost", 0)
        metrics["cost_score"] = self._score_metric(
            actual_cost,
            self.benchmarks["cost_usd"],
            lower_is_better=True
        )

        # LLM 호출 횟수
        actual_calls = trace.get("llm_call_count", 0)
        metrics["llm_calls_score"] = self._score_metric(
            actual_calls,
            self.benchmarks["llm_calls"],
            lower_is_better=True
        )

        # 종합 점수
        overall_score = sum(metrics.values()) / len(metrics)

        return self._create_result(
            score=overall_score,
            details={
                "scores": metrics,
                "actuals": {
                    "latency_ms": actual_latency,
                    "tokens": actual_tokens,
                    "cost_usd": actual_cost,
                    "llm_calls": actual_calls
                },
                "benchmarks": self.benchmarks
            }
        )

    def _score_metric(
        self,
        actual: float,
        target: float,
        lower_is_better: bool = True
    ) -> float:
        """개별 메트릭 점수 계산"""
        if lower_is_better:
            if actual <= target:
                return 1.0
            elif actual <= target * 2:
                return 1.0 - (actual - target) / target * 0.5
            else:
                return max(0, 0.5 - (actual - target * 2) / target * 0.25)
        else:
            if actual >= target:
                return 1.0
            else:
                return actual / target
```

---

## 3. 평가 파이프라인

### 3.1 파이프라인 구현

```python
# agentops/evaluation/pipeline.py

from typing import List, Dict, Optional
from dataclasses import dataclass
import asyncio

@dataclass
class EvaluationReport:
    """평가 보고서"""
    evaluation_id: str
    agent_id: str
    session_id: str
    request_id: str
    results: List[EvaluationResult]
    overall_score: float
    overall_passed: bool
    weighted_score: float
    created_at: datetime
    metadata: Dict[str, Any]

class EvaluationPipeline:
    """
    평가 파이프라인
    여러 평가기를 조합하여 종합 평가 수행
    """

    def __init__(
        self,
        evaluators: List[BaseEvaluator] = None,
        storage: EvaluationStorage = None,
        metrics_recorder: MetricsRecorder = None
    ):
        self.evaluators = evaluators or []
        self.storage = storage
        self.metrics = metrics_recorder

    def add_evaluator(self, evaluator: BaseEvaluator):
        """평가기 추가"""
        self.evaluators.append(evaluator)

    async def evaluate(
        self,
        context: EvaluationContext,
        evaluators: List[str] = None  # 특정 평가기만 실행
    ) -> EvaluationReport:
        """
        전체 평가 실행
        """
        evaluation_id = str(uuid.uuid4())
        results = []

        # 실행할 평가기 필터링
        active_evaluators = self.evaluators
        if evaluators:
            active_evaluators = [
                e for e in self.evaluators
                if e.metric.value in evaluators
            ]

        # 병렬로 평가 실행
        tasks = [
            self._run_evaluator(evaluator, context)
            for evaluator in active_evaluators
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 예외 처리
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # 실패한 평가는 낮은 점수와 신뢰도로 기록
                processed_results.append(EvaluationResult(
                    metric=active_evaluators[i].metric,
                    score=0.0,
                    passed=False,
                    threshold=active_evaluators[i].threshold,
                    confidence=0.0,
                    details={"error": str(result)},
                    reasoning=f"Evaluation failed: {result}"
                ))
            else:
                processed_results.append(result)

        # 종합 점수 계산
        overall_score = self._calculate_overall_score(processed_results)
        weighted_score = self._calculate_weighted_score(
            processed_results, active_evaluators
        )
        overall_passed = all(r.passed for r in processed_results)

        # 보고서 생성
        report = EvaluationReport(
            evaluation_id=evaluation_id,
            agent_id=context.agent_id,
            session_id=context.session_id,
            request_id=context.request_id,
            results=processed_results,
            overall_score=overall_score,
            overall_passed=overall_passed,
            weighted_score=weighted_score,
            created_at=datetime.utcnow(),
            metadata=context.metadata
        )

        # 저장
        if self.storage:
            await self.storage.save(report)

        # 메트릭 기록
        if self.metrics:
            for result in processed_results:
                self.metrics.record_evaluation(
                    metric=result.metric.value,
                    score=result.score,
                    passed=result.passed
                )

        return report

    async def _run_evaluator(
        self,
        evaluator: BaseEvaluator,
        context: EvaluationContext
    ) -> EvaluationResult:
        """개별 평가기 실행"""
        try:
            return await asyncio.wait_for(
                evaluator.evaluate(context),
                timeout=30.0  # 30초 타임아웃
            )
        except asyncio.TimeoutError:
            return EvaluationResult(
                metric=evaluator.metric,
                score=0.0,
                passed=False,
                threshold=evaluator.threshold,
                confidence=0.0,
                details={"error": "Evaluation timeout"},
                reasoning="Evaluation timed out after 30 seconds"
            )

    def _calculate_overall_score(
        self,
        results: List[EvaluationResult]
    ) -> float:
        """단순 평균 점수"""
        if not results:
            return 0.0
        return sum(r.score for r in results) / len(results)

    def _calculate_weighted_score(
        self,
        results: List[EvaluationResult],
        evaluators: List[BaseEvaluator]
    ) -> float:
        """가중 평균 점수"""
        if not results:
            return 0.0

        total_weight = sum(e.weight for e in evaluators)
        weighted_sum = sum(
            r.score * e.weight
            for r, e in zip(results, evaluators)
        )
        return weighted_sum / total_weight if total_weight > 0 else 0.0
```

### 3.2 자동 평가 설정

```python
# agentops/evaluation/auto_eval.py

class AutoEvaluationConfig:
    """자동 평가 설정"""

    def __init__(
        self,
        enabled: bool = True,
        sample_rate: float = 0.1,  # 10% 샘플링
        min_latency_ms: float = 1000,  # 1초 이상인 요청만
        evaluators: List[str] = None,  # 실행할 평가기
        async_evaluation: bool = True  # 비동기 평가
    ):
        self.enabled = enabled
        self.sample_rate = sample_rate
        self.min_latency_ms = min_latency_ms
        self.evaluators = evaluators or [
            "task_completion",
            "response_quality",
            "safety"
        ]
        self.async_evaluation = async_evaluation

class AutoEvaluator:
    """
    자동 평가 트리거
    요청 완료 후 자동으로 평가 실행
    """

    def __init__(
        self,
        pipeline: EvaluationPipeline,
        config: AutoEvaluationConfig
    ):
        self.pipeline = pipeline
        self.config = config
        self._random = random.Random()

    def should_evaluate(
        self,
        latency_ms: float
    ) -> bool:
        """평가 실행 여부 결정"""
        if not self.config.enabled:
            return False

        if latency_ms < self.config.min_latency_ms:
            return False

        return self._random.random() < self.config.sample_rate

    async def trigger_evaluation(
        self,
        context: EvaluationContext
    ):
        """평가 트리거"""
        if self.config.async_evaluation:
            # 비동기로 백그라운드에서 실행
            asyncio.create_task(
                self._run_evaluation(context)
            )
        else:
            await self._run_evaluation(context)

    async def _run_evaluation(
        self,
        context: EvaluationContext
    ):
        """평가 실행"""
        try:
            report = await self.pipeline.evaluate(
                context,
                evaluators=self.config.evaluators
            )
            logger.info(
                f"Auto evaluation completed",
                evaluation_id=report.evaluation_id,
                overall_score=report.overall_score,
                passed=report.overall_passed
            )
        except Exception as e:
            logger.error(f"Auto evaluation failed: {e}")
```

---

## 4. 평가 결과 저장 및 분석

### 4.1 저장소 인터페이스

```python
# agentops/evaluation/storage.py

from abc import ABC, abstractmethod

class EvaluationStorage(ABC):
    """평가 결과 저장소 인터페이스"""

    @abstractmethod
    async def save(self, report: EvaluationReport) -> str:
        """평가 보고서 저장"""
        pass

    @abstractmethod
    async def get(self, evaluation_id: str) -> Optional[EvaluationReport]:
        """평가 보고서 조회"""
        pass

    @abstractmethod
    async def query(
        self,
        agent_id: str = None,
        metric: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        passed_only: bool = False,
        limit: int = 100
    ) -> List[EvaluationReport]:
        """평가 보고서 검색"""
        pass

    @abstractmethod
    async def get_aggregates(
        self,
        agent_id: str,
        metric: str = None,
        time_window: str = "24h"
    ) -> Dict[str, Any]:
        """집계 통계 조회"""
        pass

class ClickHouseEvaluationStorage(EvaluationStorage):
    """ClickHouse 기반 평가 저장소"""

    async def save(self, report: EvaluationReport) -> str:
        query = """
        INSERT INTO evaluations (
            evaluation_id, agent_id, session_id, request_id,
            overall_score, overall_passed, weighted_score,
            results, created_at
        ) VALUES
        """
        # ... 구현
        pass

    async def get_aggregates(
        self,
        agent_id: str,
        metric: str = None,
        time_window: str = "24h"
    ) -> Dict[str, Any]:
        query = f"""
        SELECT
            metric,
            avg(score) as avg_score,
            min(score) as min_score,
            max(score) as max_score,
            countIf(passed = 1) as passed_count,
            count() as total_count
        FROM evaluations
        ARRAY JOIN results
        WHERE agent_id = '{agent_id}'
          AND created_at >= now() - INTERVAL {time_window}
        GROUP BY metric
        """
        # ... 실행 및 결과 반환
        pass
```

---

## 5. 다음 단계

- [Kubernetes 배포](../deployment/kubernetes) - 평가 시스템 배포
- [CI/CD 파이프라인](../deployment/cicd) - 평가 기반 배포 게이트
- [프로덕션 체크리스트](../best-practices/production-checklist) - 평가 품질 기준
