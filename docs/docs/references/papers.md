---
sidebar_position: 1
title: "참고 문헌 및 연구 자료"
description: "Agentic AI 관련 핵심 논문, 프레임워크, 커뮤니티 리소스"
---

# 참고 문헌 및 연구 자료

![Research Papers](https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=900&q=80)

*Figure: Academic Foundations of Agentic AI Research*

---

## 핵심 논문 (Foundational Papers)

### 1. 추론 및 행동 (Reasoning & Acting)

#### ReAct: Synergizing Reasoning and Acting in Language Models
- **저자**: Yao, S., Zhao, J., Yu, D., et al.
- **발표**: ICLR 2023
- **핵심 기여**: LLM에서 추론(Reasoning)과 행동(Acting)을 결합하는 프레임워크 제안
- **주요 내용**:
  - 추론 트레이스와 작업별 행동을 인터리빙
  - 할루시네이션 감소 및 해석 가능성 향상
  - HotpotQA, FEVER, ALFWorld 등에서 SOTA 달성

```bibtex
@inproceedings{yao2023react,
  title={ReAct: Synergizing Reasoning and Acting in Language Models},
  author={Yao, Shunyu and Zhao, Jeffrey and Yu, Dian and others},
  booktitle={ICLR},
  year={2023}
}
```

#### Tree of Thoughts: Deliberate Problem Solving with Large Language Models
- **저자**: Yao, S., Yu, D., Zhao, J., et al.
- **발표**: NeurIPS 2023
- **핵심 기여**: 트리 구조의 사고 과정을 통한 복잡한 문제 해결
- **주요 내용**:
  - 여러 추론 경로를 동시에 탐색
  - BFS/DFS 기반 탐색 전략
  - 자기 평가를 통한 가지치기

---

### 2. 자기 개선 (Self-Improvement)

#### Reflexion: Language Agents with Verbal Reinforcement Learning
- **저자**: Shinn, N., Cassano, F., et al.
- **발표**: NeurIPS 2023
- **핵심 기여**: 언어적 피드백을 통한 에이전트 자기 개선
- **주요 내용**:
  - 전통적 RL 없이 언어적 반성으로 학습
  - 에피소드 메모리를 통한 경험 축적
  - 의사결정, 추론, 코딩 작업에서 효과 입증

```bibtex
@inproceedings{shinn2023reflexion,
  title={Reflexion: Language Agents with Verbal Reinforcement Learning},
  author={Shinn, Noah and Cassano, Federico and others},
  booktitle={NeurIPS},
  year={2023}
}
```

#### Self-Refine: Iterative Refinement with Self-Feedback
- **저자**: Madaan, A., et al.
- **발표**: NeurIPS 2023
- **핵심 기여**: 외부 피드백 없이 자기 피드백으로 출력 개선
- **주요 내용**:
  - 생성 → 피드백 → 개선의 반복 사이클
  - 다양한 생성 작업에서 일관된 개선
  - 추가 학습 없이 기존 모델에 적용 가능

---

### 3. 멀티에이전트 시스템 (Multi-Agent Systems)

#### Generative Agents: Interactive Simulacra of Human Behavior
- **저자**: Park, J. S., O'Brien, J. C., et al.
- **발표**: UIST 2023
- **핵심 기여**: 인간 행동을 시뮬레이션하는 생성형 에이전트
- **주요 내용**:
  - 25명의 가상 에이전트가 상호작용하는 소셜 시뮬레이션
  - 기억 스트림, 반성, 계획 메커니즘
  - 창발적 사회적 행동 관찰

```bibtex
@inproceedings{park2023generative,
  title={Generative Agents: Interactive Simulacra of Human Behavior},
  author={Park, Joon Sung and O'Brien, Joseph C and others},
  booktitle={UIST},
  year={2023}
}
```

#### AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation
- **저자**: Wu, Q., et al. (Microsoft Research)
- **발표**: 2023
- **핵심 기여**: 다중 에이전트 대화를 통한 복잡한 작업 해결
- **주요 내용**:
  - 커스터마이즈 가능한 대화형 에이전트
  - 인간-AI 협업 지원
  - 코드 생성 및 실행 통합

#### CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society
- **저자**: Li, G., et al.
- **발표**: NeurIPS 2023
- **핵심 기여**: 역할극 기반 에이전트 간 협력 프레임워크
- **주요 내용**:
  - AI Assistant와 AI User 간 역할극
  - 인셉션 프롬프팅 기법
  - 대화형 협력 데이터셋 생성

---

### 4. 계획 및 도구 사용 (Planning & Tool Use)

#### Toolformer: Language Models Can Teach Themselves to Use Tools
- **저자**: Schick, T., et al. (Meta AI)
- **발표**: NeurIPS 2023
- **핵심 기여**: LLM이 스스로 API 사용법을 학습
- **주요 내용**:
  - 자기 지도 학습으로 API 호출 시점 결정
  - 계산기, 검색, 번역 등 다양한 도구 통합
  - 최소한의 인간 감독으로 학습

#### HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face
- **저자**: Shen, Y., et al.
- **발표**: NeurIPS 2023
- **핵심 기여**: LLM이 다양한 AI 모델을 조율하여 복잡한 작업 해결
- **주요 내용**:
  - ChatGPT가 컨트롤러 역할
  - Hugging Face 모델들을 도구로 활용
  - 다중 모달리티 작업 처리

#### ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs
- **저자**: Qin, Y., et al.
- **발표**: 2023
- **핵심 기여**: 대규모 실제 API 활용 능력 학습
- **주요 내용**:
  - ToolBench: 16,000+ API 벤치마크
  - DFSDT: 깊이 우선 탐색 기반 결정 트리
  - 복잡한 다단계 API 호출 처리

---

### 5. 에이전트 평가 (Agent Evaluation)

#### AgentBench: Evaluating LLMs as Agents
- **저자**: Liu, X., et al.
- **발표**: ICLR 2024
- **핵심 기여**: LLM 에이전트 평가를 위한 종합 벤치마크
- **주요 내용**:
  - 8개 환경에서 에이전트 능력 평가
  - 운영체제, 데이터베이스, 게임 등 다양한 도메인
  - 상업 모델과 오픈소스 모델 비교

#### WebArena: A Realistic Web Environment for Building Autonomous Agents
- **저자**: Zhou, S., et al.
- **발표**: ICLR 2024
- **핵심 기여**: 실제 웹 환경을 모사한 에이전트 평가 플랫폼
- **주요 내용**:
  - 4개의 실제 웹 애플리케이션
  - 812개의 다양한 작업
  - 현실적인 웹 에이전트 벤치마킹

---

## 주요 프레임워크 및 라이브러리

### 에이전트 프레임워크

| 프레임워크 | 개발사 | 주요 특징 | GitHub Stars |
|-----------|--------|----------|--------------|
| **LangChain** | LangChain | 가장 인기 있는 LLM 프레임워크, 풍부한 통합 | 70k+ |
| **LangGraph** | LangChain | 그래프 기반 워크플로우, 상태 관리 | 3k+ |
| **AutoGen** | Microsoft | 멀티에이전트 대화, 코드 실행 | 25k+ |
| **CrewAI** | CrewAI | 역할 기반 에이전트 팀 | 15k+ |
| **Semantic Kernel** | Microsoft | 엔터프라이즈 AI 통합 | 18k+ |
| **Haystack** | deepset | NLP 파이프라인, RAG 특화 | 13k+ |
| **LlamaIndex** | LlamaIndex | 데이터 연결 및 인덱싱 | 30k+ |

### 관찰 가능성 도구

| 도구 | 용도 | 특징 |
|------|------|------|
| **LangSmith** | LLM 추적/평가 | LangChain 네이티브 통합 |
| **Phoenix** | ML 관찰 가능성 | 오픈소스, Arize 지원 |
| **Weights & Biases** | 실험 추적 | 풍부한 시각화 |
| **OpenTelemetry** | 분산 추적 | 표준 기반, 벤더 중립 |
| **Helicone** | LLM 모니터링 | 비용 추적, 캐싱 |

---

## 프로토콜 및 표준

### Agent-to-Agent (A2A) Protocol
- **개발**: Google
- **목적**: 에이전트 간 상호운용성 표준
- **문서**: [A2A Protocol Specification](https://github.com/google/A2A)

### Model Context Protocol (MCP)
- **개발**: Anthropic
- **목적**: 에이전트-도구 연결 표준
- **문서**: [MCP Specification](https://modelcontextprotocol.io)

### OpenAI Function Calling
- **개발**: OpenAI
- **목적**: LLM 도구 호출 인터페이스
- **문서**: [OpenAI API Documentation](https://platform.openai.com/docs)

---

## 커뮤니티 리소스

### 학습 자료

1. **강의 및 코스**
   - Stanford CS324: Large Language Models
   - DeepLearning.AI: Building with LLMs
   - Hugging Face Course: NLP

2. **튜토리얼**
   - LangChain Documentation & Tutorials
   - AutoGen Getting Started Guide
   - CrewAI Quickstart

3. **블로그 및 뉴스레터**
   - Lilian Weng's Blog (OpenAI)
   - The Batch (Andrew Ng)
   - AI Engineering Newsletter

### 커뮤니티

| 커뮤니티 | 플랫폼 | 설명 |
|---------|--------|------|
| LangChain Discord | Discord | 가장 활발한 에이전트 커뮤니티 |
| Hugging Face Forums | Forum | 모델 및 데이터셋 논의 |
| r/LocalLLaMA | Reddit | 로컬 LLM 실행 커뮤니티 |
| AI Twitter/X | X | 최신 연구 및 트렌드 |

---

## 2024-2025 주목할 연구 방향

### 1. 장기 기억 및 지속 학습
- 에피소드 기억의 효율적 관리
- 지속적 지식 업데이트
- 망각 방지 메커니즘

### 2. 안전한 에이전트
- 가치 정렬 (Value Alignment)
- 감사 가능한 의사결정
- 샌드박싱 및 권한 관리

### 3. 효율적 에이전트
- 모델 증류를 통한 경량화
- 캐싱 및 재사용 전략
- 적응적 컴퓨팅

### 4. 멀티모달 에이전트
- 시각-언어 에이전트
- 로보틱스 통합
- 실세계 인터랙션

### 5. 에이전트 생태계
- 표준화된 프로토콜
- 에이전트 마켓플레이스
- 자율적 협력 네트워크

---

## 추가 읽을거리

### 서베이 논문

1. **A Survey on Large Language Model based Autonomous Agents** (2023)
   - LLM 기반 자율 에이전트의 종합적 서베이

2. **The Rise and Potential of Large Language Model Based Agents** (2023)
   - 에이전트 아키텍처 및 응용 분야 분석

3. **Agent AI: Surveying the Horizons of Multimodal Interaction** (2024)
   - 멀티모달 에이전트의 현황과 미래

### 기술 보고서

1. **Anthropic: Claude's Character** - AI 안전성 및 정렬
2. **OpenAI: GPT-4 Technical Report** - 대규모 모델 능력 분석
3. **Google DeepMind: Gemini** - 멀티모달 AI 시스템

---

## 인용 및 참고

본 문서에서 다룬 내용을 인용할 경우 다음 형식을 사용하세요:

```bibtex
@misc{agentic-ai-docs-2024,
  title={Agentic AI 2026: Agent-to-Agent Communication & AgentOps},
  author={Agentic AI Research},
  year={2024},
  howpublished={\url{https://mypalesong.github.io/agent/}},
}
```

---

## 다음 단계

- [**Agentic AI 개요**](/docs/intro): 기본 개념으로 돌아가기
- [**실전 예제**](/docs/practical/case-studies): 연구를 실무에 적용
- [**아키텍처 패턴**](/docs/architecture/patterns): 설계 가이드
