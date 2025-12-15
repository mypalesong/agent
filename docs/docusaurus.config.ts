import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Agentic AI 2026',
  tagline: 'Agent-to-Agent Communication & AgentOps - The Future of Autonomous AI Systems',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://mypalesong.github.io',
  baseUrl: '/agent/',

  organizationName: 'mypalesong',
  projectName: 'agent',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/mypalesong/agent/tree/main/docs/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/mypalesong/agent/tree/main/docs/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/agentic-ai-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Agentic AI 2026',
      logo: {
        alt: 'Agentic AI Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/mypalesong/agent',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Agentic AI Concepts',
              to: '/docs/intro',
            },
            {
              label: 'Agent-to-Agent',
              to: '/docs/agent-to-agent/overview',
            },
            {
              label: 'AgentOps',
              to: '/docs/agentops/overview',
            },
          ],
        },
        {
          title: 'LangGraph',
          items: [
            {
              label: '기초 가이드',
              to: '/docs/langgraph/beginner',
            },
            {
              label: '중급 가이드',
              to: '/docs/langgraph/intermediate',
            },
            {
              label: '고급 가이드',
              to: '/docs/langgraph/advanced',
            },
            {
              label: 'Real World 적용',
              to: '/docs/langgraph/real-world',
            },
          ],
        },
        {
          title: 'Research',
          items: [
            {
              label: 'Papers & References',
              to: '/docs/references/papers',
            },
            {
              label: 'Case Studies',
              to: '/docs/practical/case-studies',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/mypalesong/agent',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Agentic AI Research. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'typescript', 'json', 'yaml', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
