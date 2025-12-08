import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
  link: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Agentic AI',
    emoji: '🤖',
    description: (
      <>
        자율적으로 추론하고, 계획하며, 도구를 활용하는 차세대 AI 시스템.
        2026년을 향한 AI 에이전트의 진화를 탐구합니다.
      </>
    ),
    link: '/docs/intro',
  },
  {
    title: 'Agent-to-Agent (A2A)',
    emoji: '🔗',
    description: (
      <>
        에이전트 간 표준 통신 프로토콜. 상호 발견, 협상, 협력을 통해
        단일 에이전트를 넘어선 에이전트 네트워크를 구축합니다.
      </>
    ),
    link: '/docs/agent-to-agent/overview',
  },
  {
    title: 'AgentOps',
    emoji: '📊',
    description: (
      <>
        AI 에이전트의 배포, 모니터링, 최적화를 위한 운영 체계.
        DevOps의 다음 단계, AgentOps를 만나보세요.
      </>
    ),
    link: '/docs/agentops/overview',
  },
  {
    title: 'Architecture Patterns',
    emoji: '🏗️',
    description: (
      <>
        검증된 에이전트 시스템 설계 패턴. Router, Pipeline, Orchestrator,
        Debate 패턴 등 실전에서 활용할 수 있는 아키텍처를 제공합니다.
      </>
    ),
    link: '/docs/architecture/patterns',
  },
  {
    title: 'Real-world Case Studies',
    emoji: '💼',
    description: (
      <>
        금융, 헬스케어, 이커머스, DevOps, 교육 등 다양한 산업에서의
        Agentic AI 적용 사례와 구현 코드를 제공합니다.
      </>
    ),
    link: '/docs/practical/case-studies',
  },
  {
    title: 'Research & References',
    emoji: '📚',
    description: (
      <>
        ReAct, Reflexion, Generative Agents 등 핵심 논문과
        LangChain, AutoGen 등 주요 프레임워크 가이드를 제공합니다.
      </>
    ),
    link: '/docs/references/papers',
  },
];

function Feature({title, emoji, description, link}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center" style={{fontSize: '4rem', marginBottom: '1rem'}}>
        {emoji}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">
          <Link to={link} style={{color: 'inherit', textDecoration: 'none'}}>
            {title}
          </Link>
        </Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
