---
sidebar_position: 1
title: "에이전트 아키텍처 패턴"
description: "검증된 에이전트 시스템 설계 패턴과 안티패턴"
---

# 에이전트 아키텍처 패턴

> "좋은 아키텍처는 변화를 수용하고, 복잡성을 관리하며, 확장 가능한 시스템을 만든다."

## 1. 기본 아키텍처 패턴

### 1.1 단일 에이전트 패턴 (Single Agent)

가장 간단한 형태의 에이전트 아키텍처:

```
┌────────────────────────────────────────────────────────┐
│                    Single Agent                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│   User Input                                            │
│       │                                                 │
│       ↓                                                 │
│   ┌─────────────────────────────────────────────────┐  │
│   │                    Agent                         │  │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐        │  │
│   │  │ Reason  │→│ Plan    │→│ Execute │        │  │
│   │  └─────────┘  └─────────┘  └─────────┘        │  │
│   │       ↓                          ↓             │  │
│   │  ┌─────────────────────────────────────────┐  │  │
│   │  │              Tool Suite                  │  │  │
│   │  │  [Search] [Code] [API] [Database]       │  │  │
│   │  └─────────────────────────────────────────┘  │  │
│   └─────────────────────────────────────────────────┘  │
│       │                                                 │
│       ↓                                                 │
│   Response                                              │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**적합한 경우:**
- 단순한 작업 자동화
- 명확하게 정의된 도메인
- 빠른 프로토타이핑

**구현 예시:**

```python
class SingleAgent:
    """단일 에이전트 패턴"""

    def __init__(self, tools: List[Tool]):
        self.tools = ToolRegistry(tools)
        self.llm = LLM()

    async def run(self, task: str) -> str:
        messages = [{"role": "user", "content": task}]

        while True:
            # 1. 추론 및 계획
            response = await self.llm.generate(
                messages,
                tools=self.tools.schemas
            )

            # 2. 도구 호출 확인
            if response.tool_calls:
                for tool_call in response.tool_calls:
                    result = await self.tools.execute(
                        tool_call.name,
                        tool_call.arguments
                    )
                    messages.append({
                        "role": "tool",
                        "content": result
                    })
            else:
                # 완료
                return response.content
```

---

### 1.2 라우터 패턴 (Router Pattern)

작업을 적절한 전문 에이전트로 라우팅:

```
┌────────────────────────────────────────────────────────────┐
│                      Router Pattern                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   User Input                                                │
│       │                                                     │
│       ↓                                                     │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Router Agent                            │  │
│   │         (Intent Classification)                      │  │
│   └───────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐              │
│         ↓                 ↓                 ↓              │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐        │
│   │ Coding   │      │ Research │      │ Writing  │        │
│   │ Agent    │      │ Agent    │      │ Agent    │        │
│   └──────────┘      └──────────┘      └──────────┘        │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class RouterAgent:
    """라우터 에이전트 패턴"""

    def __init__(self):
        self.specialists = {
            "coding": CodingAgent(),
            "research": ResearchAgent(),
            "writing": WritingAgent(),
            "analysis": AnalysisAgent(),
        }

    async def route(self, task: str) -> str:
        # 1. 의도 분류
        intent = await self._classify_intent(task)

        # 2. 전문 에이전트 선택
        if intent.category in self.specialists:
            agent = self.specialists[intent.category]
            return await agent.run(task)
        else:
            # 기본 처리
            return await self._handle_default(task)

    async def _classify_intent(self, task: str) -> Intent:
        prompt = f"""
        다음 작업의 유형을 분류하세요:

        작업: {task}

        카테고리:
        - coding: 코드 작성, 디버깅, 리팩토링
        - research: 정보 검색, 분석, 조사
        - writing: 문서 작성, 편집, 요약
        - analysis: 데이터 분석, 인사이트 도출

        JSON 형식으로 응답: {{"category": "...", "confidence": 0.0-1.0}}
        """

        response = await self.llm.generate(prompt)
        return Intent(**json.loads(response))
```

---

### 1.3 파이프라인 패턴 (Pipeline Pattern)

순차적 처리 단계로 구성:

```
┌────────────────────────────────────────────────────────────┐
│                    Pipeline Pattern                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Input                                                     │
│     │                                                       │
│     ↓                                                       │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │ Stage 1  │ → │ Stage 2  │ → │ Stage 3  │            │
│   │ Extract  │    │ Transform│    │ Generate │            │
│   └──────────┘    └──────────┘    └──────────┘            │
│                                         │                   │
│                                         ↓                   │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │ Stage 6  │ ← │ Stage 5  │ ← │ Stage 4  │            │
│   │ Output   │    │ Validate │    │ Review   │            │
│   └──────────┘    └──────────┘    └──────────┘            │
│     │                                                       │
│     ↓                                                       │
│   Output                                                    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class PipelineAgent:
    """파이프라인 패턴"""

    def __init__(self, stages: List[PipelineStage]):
        self.stages = stages

    async def run(self, input_data: Any) -> Any:
        current = input_data

        for stage in self.stages:
            # 단계 실행
            result = await stage.process(current)

            # 검증
            if not result.valid:
                if stage.can_retry:
                    result = await self._retry_stage(stage, current)
                else:
                    raise PipelineError(f"Stage {stage.name} failed")

            current = result.output

        return current

    async def _retry_stage(self,
                          stage: PipelineStage,
                          input_data: Any,
                          max_retries: int = 3) -> StageResult:
        for attempt in range(max_retries):
            result = await stage.process(
                input_data,
                retry_attempt=attempt
            )
            if result.valid:
                return result

        raise PipelineError(f"Stage {stage.name} failed after retries")


# 문서 처리 파이프라인 예시
document_pipeline = PipelineAgent([
    ExtractTextStage(),
    ParseStructureStage(),
    AnalyzeContentStage(),
    GenerateSummaryStage(),
    ValidateOutputStage(),
    FormatOutputStage(),
])
```

---

## 2. 고급 멀티에이전트 패턴

### 2.1 오케스트레이터-워커 패턴 (Orchestrator-Worker)

중앙 오케스트레이터가 워커들을 조율:

```
┌─────────────────────────────────────────────────────────────┐
│               Orchestrator-Worker Pattern                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                   ┌──────────────────┐                       │
│                   │   Orchestrator   │                       │
│                   │     Agent        │                       │
│                   └────────┬─────────┘                       │
│                            │                                 │
│          ┌─────────────────┼─────────────────┐              │
│          │                 │                 │              │
│          ↓                 ↓                 ↓              │
│    ┌──────────┐      ┌──────────┐      ┌──────────┐        │
│    │ Worker A │      │ Worker B │      │ Worker C │        │
│    │ (Search) │      │ (Analyze)│      │ (Write)  │        │
│    └────┬─────┘      └────┬─────┘      └────┬─────┘        │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           ↓                                 │
│                   ┌──────────────────┐                       │
│                   │   Aggregator     │                       │
│                   │   (결과 통합)    │                       │
│                   └──────────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class OrchestratorAgent:
    """오케스트레이터-워커 패턴"""

    def __init__(self, workers: Dict[str, WorkerAgent]):
        self.workers = workers
        self.task_queue = asyncio.Queue()
        self.results = {}

    async def execute_plan(self, plan: ExecutionPlan) -> Dict:
        """실행 계획에 따라 워커들 조율"""

        # 1. 작업 분배
        for task in plan.tasks:
            # 의존성이 해결된 작업만 큐에 추가
            if self._dependencies_resolved(task):
                await self.task_queue.put(task)

        # 2. 워커 실행
        active_tasks = []
        while not self.task_queue.empty() or active_tasks:
            # 새 작업 시작
            while not self.task_queue.empty():
                task = await self.task_queue.get()
                worker = self.workers[task.worker_type]
                active_tasks.append(
                    asyncio.create_task(
                        self._execute_task(worker, task)
                    )
                )

            # 완료된 작업 확인
            done, pending = await asyncio.wait(
                active_tasks,
                return_when=asyncio.FIRST_COMPLETED
            )

            for completed in done:
                result = await completed
                self.results[result.task_id] = result

                # 의존성 해결된 후속 작업 큐에 추가
                await self._schedule_dependents(result.task_id)

            active_tasks = list(pending)

        # 3. 결과 집계
        return await self._aggregate_results()

    async def _execute_task(self,
                           worker: WorkerAgent,
                           task: Task) -> TaskResult:
        """개별 작업 실행"""
        try:
            # 의존성 결과 주입
            inputs = self._gather_dependency_results(task)
            result = await worker.execute(task, inputs)
            return TaskResult(
                task_id=task.id,
                success=True,
                output=result
            )
        except Exception as e:
            return TaskResult(
                task_id=task.id,
                success=False,
                error=str(e)
            )
```

---

### 2.2 토론 패턴 (Debate Pattern)

여러 에이전트가 토론을 통해 결론 도출:

```
┌────────────────────────────────────────────────────────────┐
│                     Debate Pattern                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Topic: "최적의 아키텍처 결정"                              │
│                                                             │
│   Round 1:                                                  │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐        │
│   │ Agent A  │      │ Agent B  │      │ Agent C  │        │
│   │(찬성)    │      │(반대)    │      │(중립)    │        │
│   └────┬─────┘      └────┬─────┘      └────┬─────┘        │
│        │                 │                 │               │
│        └─────────────────┼─────────────────┘               │
│                          ↓                                  │
│                   ┌──────────────┐                          │
│                   │  Moderator   │                          │
│                   │  (종합/진행) │                          │
│                   └──────┬───────┘                          │
│                          │                                  │
│                          ↓                                  │
│   Round 2: (반박 및 재논의)                                 │
│        ...                                                  │
│                          ↓                                  │
│   Final: Consensus or Majority Decision                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class DebateOrchestrator:
    """토론 패턴 - 다양한 관점을 통한 의사결정"""

    def __init__(self,
                 debaters: List[DebaterAgent],
                 moderator: ModeratorAgent,
                 max_rounds: int = 3):
        self.debaters = debaters
        self.moderator = moderator
        self.max_rounds = max_rounds

    async def debate(self, topic: str, context: Dict) -> DebateResult:
        """토론 진행"""

        discussion_history = []

        for round_num in range(self.max_rounds):
            round_arguments = []

            # 1. 각 토론자 발언
            for debater in self.debaters:
                argument = await debater.argue(
                    topic=topic,
                    context=context,
                    history=discussion_history,
                    round=round_num
                )
                round_arguments.append({
                    "debater": debater.name,
                    "position": debater.position,
                    "argument": argument
                })

            discussion_history.append({
                "round": round_num,
                "arguments": round_arguments
            })

            # 2. 모더레이터 종합
            summary = await self.moderator.summarize(
                discussion_history
            )

            # 3. 합의 확인
            if summary.consensus_reached:
                return DebateResult(
                    conclusion=summary.conclusion,
                    consensus=True,
                    rounds=round_num + 1,
                    history=discussion_history
                )

        # 최종 결정 (합의 실패 시)
        final_decision = await self.moderator.make_decision(
            discussion_history
        )

        return DebateResult(
            conclusion=final_decision,
            consensus=False,
            rounds=self.max_rounds,
            history=discussion_history
        )


class DebaterAgent:
    """토론 참가자 에이전트"""

    def __init__(self, name: str, position: str, perspective: str):
        self.name = name
        self.position = position
        self.perspective = perspective

    async def argue(self,
                   topic: str,
                   context: Dict,
                   history: List,
                   round: int) -> Argument:
        """논점 제시"""

        prompt = f"""
        ## 토론 참가

        주제: {topic}
        당신의 입장: {self.position}
        당신의 관점: {self.perspective}

        이전 토론 내용:
        {json.dumps(history, ensure_ascii=False)}

        현재 라운드: {round + 1}

        ## 지시사항
        1. 당신의 입장을 논리적으로 옹호하세요
        2. 이전 라운드의 반대 논점에 반박하세요
        3. 새로운 증거나 논점을 제시하세요
        4. 건설적이고 존중하는 톤을 유지하세요

        논점을 제시하세요.
        """

        response = await self.llm.generate(prompt)
        return Argument(
            content=response,
            position=self.position,
            round=round
        )
```

---

### 2.3 계층적 에이전트 패턴 (Hierarchical Agents)

관리자-실행자 계층 구조:

```
┌─────────────────────────────────────────────────────────────┐
│               Hierarchical Agent Pattern                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌───────────────┐                         │
│                    │   Executive   │  ← 전략적 결정          │
│                    │    Agent      │                         │
│                    └───────┬───────┘                         │
│                            │                                 │
│            ┌───────────────┼───────────────┐                │
│            ↓               ↓               ↓                │
│     ┌───────────┐   ┌───────────┐   ┌───────────┐          │
│     │  Manager  │   │  Manager  │   │  Manager  │  ← 전술적│
│     │  Agent A  │   │  Agent B  │   │  Agent C  │    결정  │
│     └─────┬─────┘   └─────┬─────┘   └─────┬─────┘          │
│           │               │               │                 │
│     ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐          │
│     ↓     ↓     ↓   ↓     ↓     ↓   ↓     ↓     │          │
│   [Worker Agents - 실행 레벨]                    │          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class HierarchicalAgentSystem:
    """계층적 에이전트 시스템"""

    def __init__(self):
        self.executive = ExecutiveAgent()
        self.managers = {
            "engineering": EngineeringManagerAgent(),
            "research": ResearchManagerAgent(),
            "operations": OperationsManagerAgent(),
        }
        self.workers = WorkerPool()

    async def execute_mission(self, mission: str) -> MissionResult:
        """미션 실행"""

        # 1. Executive: 전략 수립
        strategy = await self.executive.create_strategy(mission)

        # 2. Managers: 전술 계획
        tactical_plans = {}
        for dept, objectives in strategy.department_objectives.items():
            manager = self.managers[dept]
            plan = await manager.create_tactical_plan(objectives)
            tactical_plans[dept] = plan

        # 3. Workers: 실행
        results = {}
        for dept, plan in tactical_plans.items():
            manager = self.managers[dept]
            dept_results = await manager.execute_plan(
                plan, self.workers
            )
            results[dept] = dept_results

        # 4. Executive: 결과 평가 및 조정
        final_result = await self.executive.evaluate_and_adjust(
            mission, strategy, results
        )

        return final_result


class ExecutiveAgent:
    """최고 경영 에이전트"""

    async def create_strategy(self, mission: str) -> Strategy:
        """전략 수립"""

        prompt = f"""
        ## 전략 기획

        미션: {mission}

        다음을 포함하는 전략을 수립하세요:
        1. 핵심 목표 (3-5개)
        2. 부서별 할당 (engineering, research, operations)
        3. 성공 지표 (KPIs)
        4. 리스크 요소
        5. 타임라인

        JSON 형식으로 응답.
        """

        response = await self.llm.generate(prompt)
        return Strategy(**json.loads(response))


class ManagerAgent:
    """관리자 에이전트"""

    def __init__(self, department: str):
        self.department = department

    async def create_tactical_plan(self,
                                   objectives: List[str]) -> TacticalPlan:
        """전술 계획 수립"""

        tasks = []
        for objective in objectives:
            # 목표를 구체적 작업으로 분해
            task_breakdown = await self._decompose_objective(objective)
            tasks.extend(task_breakdown)

        # 우선순위 및 의존성 설정
        prioritized = await self._prioritize_tasks(tasks)

        return TacticalPlan(
            department=self.department,
            tasks=prioritized,
            estimated_duration=self._estimate_duration(prioritized)
        )

    async def execute_plan(self,
                          plan: TacticalPlan,
                          worker_pool: WorkerPool) -> Dict:
        """계획 실행 관리"""

        results = {}

        for task in plan.tasks:
            # 워커 할당
            worker = await worker_pool.acquire(task.required_skills)

            # 작업 실행
            result = await worker.execute(task)

            # 품질 검증
            if not await self._verify_quality(result):
                result = await self._handle_quality_issue(task, result)

            results[task.id] = result

            # 워커 반환
            worker_pool.release(worker)

        return results
```

---

## 3. 특수 목적 패턴

### 3.1 반성 패턴 (Reflection Pattern)

자기 평가와 개선을 통한 품질 향상:

```
┌────────────────────────────────────────────────────────────┐
│                   Reflection Pattern                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    Actor Agent                       │  │
│   │              (작업 수행 에이전트)                    │  │
│   └───────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│                           ↓ Output                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                   Critic Agent                       │  │
│   │              (평가 에이전트)                         │  │
│   └───────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│                           ↓ Feedback                        │
│                   ┌───────────────┐                         │
│                   │   Improved?   │                         │
│                   └───────┬───────┘                         │
│                     Yes ↙   ↘ No                            │
│                    Done      │                              │
│                              ↓                              │
│                        ┌──────────┐                         │
│                        │  Retry   │ ───→ Actor Agent       │
│                        └──────────┘                         │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class ReflectionAgent:
    """반성 패턴 구현"""

    def __init__(self,
                 actor: Agent,
                 critic: Agent,
                 max_iterations: int = 3):
        self.actor = actor
        self.critic = critic
        self.max_iterations = max_iterations

    async def execute_with_reflection(self,
                                     task: str) -> ReflectionResult:
        """반성을 통한 개선된 실행"""

        history = []

        for iteration in range(self.max_iterations):
            # 1. Actor: 작업 수행
            output = await self.actor.execute(
                task=task,
                previous_feedback=history[-1]["feedback"] if history else None
            )

            # 2. Critic: 평가
            critique = await self.critic.evaluate(
                task=task,
                output=output,
                iteration=iteration
            )

            history.append({
                "iteration": iteration,
                "output": output,
                "critique": critique,
                "feedback": critique.feedback
            })

            # 3. 품질 충족 확인
            if critique.satisfactory:
                return ReflectionResult(
                    final_output=output,
                    iterations=iteration + 1,
                    history=history,
                    quality_score=critique.score
                )

        # 최대 반복 후 최선의 결과 반환
        best = max(history, key=lambda x: x["critique"].score)
        return ReflectionResult(
            final_output=best["output"],
            iterations=self.max_iterations,
            history=history,
            quality_score=best["critique"].score
        )


class CriticAgent:
    """비평 에이전트"""

    async def evaluate(self,
                       task: str,
                       output: str,
                       iteration: int) -> Critique:
        """출력 품질 평가"""

        prompt = f"""
        ## 출력 품질 평가

        ### 원래 작업
        {task}

        ### 현재 출력 (반복 {iteration + 1})
        {output}

        ### 평가 기준
        1. 정확성 (1-10)
        2. 완전성 (1-10)
        3. 명확성 (1-10)
        4. 관련성 (1-10)

        ### 요구사항
        - 각 기준별 점수와 이유
        - 구체적인 개선 제안
        - 전체 만족 여부 (점수 합계 32점 이상이면 만족)

        JSON 형식으로 응답.
        """

        response = await self.llm.generate(prompt)
        data = json.loads(response)

        total_score = sum(data["scores"].values())

        return Critique(
            scores=data["scores"],
            feedback=data["improvement_suggestions"],
            score=total_score / 40,  # 정규화
            satisfactory=total_score >= 32
        )
```

---

### 3.2 도구 제작자 패턴 (Tool Maker Pattern)

에이전트가 필요한 도구를 직접 생성:

```
┌────────────────────────────────────────────────────────────┐
│                  Tool Maker Pattern                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Task: "복잡한 데이터 변환 필요"                           │
│       │                                                     │
│       ↓                                                     │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Tool Maker Agent                        │  │
│   │         (필요한 도구 식별 및 생성)                   │  │
│   └───────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│                           ↓                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Generated Tool                          │  │
│   │         def custom_transform(data):                  │  │
│   │             # 생성된 코드                            │  │
│   │             ...                                      │  │
│   └───────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│                           ↓                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Tool Validator                          │  │
│   │         (안전성 및 정확성 검증)                      │  │
│   └───────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│                           ↓                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Executor Agent                          │  │
│   │         (생성된 도구로 작업 수행)                    │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**구현 예시:**

```python
class ToolMakerAgent:
    """도구 제작자 에이전트"""

    def __init__(self):
        self.tool_registry = DynamicToolRegistry()
        self.validator = ToolValidator()
        self.sandbox = SecureSandbox()

    async def get_or_create_tool(self,
                                task_description: str,
                                required_capability: str) -> Tool:
        """필요한 도구 획득 또는 생성"""

        # 1. 기존 도구 검색
        existing = self.tool_registry.find(required_capability)
        if existing:
            return existing

        # 2. 새 도구 생성
        tool_code = await self._generate_tool(
            task_description,
            required_capability
        )

        # 3. 검증
        validation = await self.validator.validate(tool_code)
        if not validation.safe:
            raise ToolCreationError(validation.issues)

        # 4. 테스트
        test_result = await self._test_tool(tool_code)
        if not test_result.passed:
            # 수정 시도
            tool_code = await self._fix_tool(tool_code, test_result.errors)

        # 5. 등록
        tool = self._create_tool(required_capability, tool_code)
        self.tool_registry.register(tool)

        return tool

    async def _generate_tool(self,
                            task: str,
                            capability: str) -> str:
        """도구 코드 생성"""

        prompt = f"""
        ## 도구 생성 요청

        작업 설명: {task}
        필요한 기능: {capability}

        ## 요구사항
        1. Python 함수로 구현
        2. 타입 힌트 포함
        3. docstring으로 사용법 설명
        4. 에러 처리 포함
        5. 부작용 없는 순수 함수 선호

        ## 보안 제약
        - 파일 시스템 접근 금지
        - 네트워크 접근 금지
        - 외부 패키지 import 제한

        코드만 출력하세요.
        ```python
        ```
        """

        response = await self.llm.generate(prompt)
        return self._extract_code(response)


class ToolValidator:
    """도구 안전성 검증기"""

    FORBIDDEN_PATTERNS = [
        r'import\s+os',
        r'import\s+subprocess',
        r'open\s*\(',
        r'exec\s*\(',
        r'eval\s*\(',
        r'__import__',
        r'requests\.',
        r'urllib\.',
    ]

    async def validate(self, code: str) -> ValidationResult:
        """코드 안전성 검증"""

        issues = []

        # 1. 정적 분석
        for ptn in self.FORBIDDEN_PATTERNS:
            if re.search(ptn, code):
                issues.append("Forbidden pattern detected: " + ptn)

        # 2. AST 분석
        try:
            tree = ast.parse(code)
            ast_issues = self._analyze_ast(tree)
            issues.extend(ast_issues)
        except SyntaxError as err:
            issues.append("Syntax error: " + str(err))

        return ValidationResult(
            safe=len(issues) == 0,
            issues=issues
        )
```

---

## 4. 안티패턴

피해야 할 일반적인 설계 실수들:

### 4.1 무한 루프 에이전트

```python
# ❌ 안티패턴: 종료 조건 없는 에이전트
class BadAgent:
    async def run(self, task):
        while True:  # 무한 루프 위험!
            result = await self.think(task)
            if result.done:
                break  # 조건이 절대 참이 되지 않을 수 있음

# ✅ 해결책: 명시적 제한
class GoodAgent:
    MAX_ITERATIONS = 10

    async def run(self, task):
        for i in range(self.MAX_ITERATIONS):
            result = await self.think(task)
            if result.done:
                return result

        # 최대 반복 후 부분 결과 반환
        return PartialResult(iterations=self.MAX_ITERATIONS)
```

### 4.2 과도한 에이전트 분할

```python
# ❌ 안티패턴: 불필요하게 많은 에이전트
class OverEngineeredSystem:
    def __init__(self):
        self.parser_agent = ParserAgent()
        self.validator_agent = ValidatorAgent()
        self.formatter_agent = FormatterAgent()
        self.capitalizer_agent = CapitalizerAgent()  # 과도함
        self.trimmer_agent = TrimmerAgent()  # 과도함
        # ...

# ✅ 해결책: 적절한 응집도
class WellDesignedSystem:
    def __init__(self):
        self.input_processor = InputProcessorAgent()  # 파싱+검증
        self.core_logic = CoreLogicAgent()
        self.output_formatter = OutputFormatterAgent()  # 포맷팅
```

### 4.3 컨텍스트 폭발

```python
# ❌ 안티패턴: 무제한 컨텍스트 누적
class BadMemoryAgent:
    def __init__(self):
        self.full_history = []  # 계속 증가!

    async def run(self, task):
        self.full_history.append(task)
        # 모든 이력을 컨텍스트로 전달 -> 토큰 폭발
        return await self.llm.generate(self.full_history)

# ✅ 해결책: 스마트 메모리 관리
class SmartMemoryAgent:
    def __init__(self, max_context_tokens=4000):
        self.memory = SlidingWindowMemory(max_tokens=max_context_tokens)
        self.summary_memory = SummaryMemory()

    async def run(self, task):
        relevant = self.memory.get_relevant(task)
        summary = self.summary_memory.get_summary()
        context = self._build_context(task, relevant, summary)
        return await self.llm.generate(context)
```

---

## 5. 패턴 선택 가이드

```
┌─────────────────────────────────────────────────────────────┐
│                  패턴 선택 의사결정 트리                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   작업이 단일 도메인인가?                                    │
│   │                                                          │
│   ├─ Yes → 단순한 작업인가?                                  │
│   │         ├─ Yes → Single Agent                           │
│   │         └─ No  → Pipeline Pattern                        │
│   │                                                          │
│   └─ No → 전문 영역들이 독립적인가?                          │
│            ├─ Yes → Router Pattern                           │
│            └─ No  → 협업이 필요한가?                         │
│                      ├─ 계층적 → Hierarchical Pattern        │
│                      ├─ 병렬적 → Orchestrator-Worker         │
│                      └─ 토론적 → Debate Pattern              │
│                                                              │
│   품질 개선이 중요한가?                                      │
│   └─ Yes → Reflection Pattern 추가                           │
│                                                              │
│   동적 기능 확장이 필요한가?                                 │
│   └─ Yes → Tool Maker Pattern 추가                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 다음 단계

- [**실전 사례**](/docs/practical/case-studies): 패턴 적용 사례
- [**AgentOps**](/docs/agentops/overview): 운영 관리
- [**참고 문헌**](/docs/references/papers): 관련 연구
