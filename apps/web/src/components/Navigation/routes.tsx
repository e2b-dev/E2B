import { Braces, CheckCircle, Home, MessagesSquare } from 'lucide-react'
import apiRefRoutesJson from './apiRefRoutes.json'

export interface NavLink {
  title: string
  href: string
  icon?: React.ReactNode
}

export interface NavSubgroup {
  title: string
  icon?: React.ReactNode
  links: NavLink[]
}

export interface NavGroup {
  title?: string
  icon?: React.ReactNode
  items: Array<NavLink | NavSubgroup>
}

export const docRoutes: NavGroup[] = [
  {
    items: [
      {
        title: 'Home',
        href: '/docs',
        icon: <Home size={16} />,
      },
      {
        title: 'Quickstart',
        icon: <CheckCircle size={16} />,
        links: [
          {
            title: 'Running your first Sandbox',
            href: '/docs/quickstart',
          },
          {
            title: 'Connect LLMs to E2B',
            href: '/docs/quickstart/connect-llms',
          },
          {
            title: 'Upload & download files',
            href: '/docs/quickstart/upload-download-files',
          },
          {
            title: 'Install custom packages',
            href: '/docs/quickstart/install-custom-packages',
          },
        ],
      },
      {
        title: 'Cookbook',
        href: 'https://github.com/e2b-dev/e2b-cookbook',
        icon: <Braces size={16} />,
      },
      {
        title: 'Need help?',
        href: '/docs/support',
        icon: <MessagesSquare size={16} />,
      },
      {
        title: 'Migrating from v0.* to v1.*',
        href: '/docs/quickstart/migrating-from-v0',
      },
    ],
  },
  // {
  //   title: 'Quickstart',
  //   items: [
  //     {
  //       title: 'Running your first Sandbox',
  //       href: '/docs/hello-world/js',
  //     },
  //     {
  //       title: 'Connecting LLMs to E2B',
  //       links: [
  //         {
  //           title: 'OpenAI',
  //           href: '/docs/integrations/openai',
  //         },
  //         {
  //           title: 'Anthropic',
  //           href: '/docs/integrations/ai-sdk',
  //         },
  //         {
  //           title: 'Mistral',
  //           href: '/docs/integrations/ai-sdk',
  //         },
  //         {
  //           title: 'Vercel AI SDK',
  //           href: '/docs/integrations/ai-sdk',
  //         },
  //         {
  //           title: 'LangChain',
  //           href: '/docs/integrations/ai-sdk',
  //         },
  //         {
  //           title: 'LlamaIndex',
  //           href: '/docs/integrations/ai-sdk',
  //         },
  //       ],
  //     },
  //     {
  //       title: 'Uploading & downloading files',
  //       href: '/docs/code-execution/python',
  //     },
  //     {
  //       title: 'Install custom packages',
  //       href: '/docs/code-execution/python',
  //     },
  //   ]
  // },
  {
    title: 'Code Interpreting',
    items: [
      {
        title: 'Analyze data with AI',
        links: [
          {
            title: 'Overview',
            href: '/docs/code-interpreting/analyze-data-with-ai',
          },
          {
            title: 'Pre-installed libraries',
            href: '/docs/code-interpreting/analyze-data-with-ai/pre-installed-libraries',
          },
        ],
      },
      {
        title: 'Charts & visualizations',
        href: '/docs/code-interpreting/create-charts-visualizations',
        links: [
          {
            title: 'Overview',
            href: '/docs/code-interpreting/create-charts-visualizations',
          },
          {
            title: 'Static charts',
            href: '/docs/code-interpreting/create-charts-visualizations/static-charts',
          },
          {
            title: 'Interactive charts',
            href: '/docs/code-interpreting/create-charts-visualizations/interactive-charts',
          },
        ],
      },
      {
        title: 'Streaming',
        href: '/docs/code-interpreting/streaming',
      },
      // {
      //   title: '* Connect your data',
      //   href: '/docs/code-interpreting/connect-your-data',
      // },
      {
        title: 'Supported languages',
        links: [
          {
            title: 'Overview',
            href: '/docs/code-interpreting/supported-languages',
          },
          {
            title: 'Python',
            href: '/docs/code-interpreting/supported-languages/python',
          },
          {
            title: 'JavaScript',
            href: '/docs/code-interpreting/supported-languages/javascript',
          },
          {
            title: 'R',
            href: '/docs/code-interpreting/supported-languages/r',
          },
          {
            title: 'Java',
            href: '/docs/code-interpreting/supported-languages/java',
          },
          {
            title: 'Bash',
            href: '/docs/code-interpreting/supported-languages/bash',
          },
        ],
      },
      // {
      //   title: '* Parsing code execution results',
      //   href: '/docs/code-interpreting/todo',
      // },
    ],
  },
  // {
  //   title: 'Guides', // How to's
  //   items: [
  //     {
  //       title: 'Set working directory',
  //       href: '/docs/f',
  //     },
  //     {
  //       title: 'Link specific sandbox with user',
  //       href: '/docs/g',
  //     }
  //   ]
  // },
  // {
  //   title: '* AI Code Execution',
  //   items: [
  //     {
  //       title: '* Python',
  //       href: '/docs/code-execution/python',
  //       icon: <Image src={logoPython} alt="Python" width={20} height={20} />,
  //     },
  //     {
  //       title: '* JavaScript',
  //       href: '/docs/code-execution/python',
  //       icon: <Image src={logoNode} alt="JavaScript" width={20} height={20} />,
  //     },
  //     {
  //       title: '* TypeScript',
  //       href: '/docs/code-execution/python',
  //     },
  //     {
  //       title: '* Custom language',
  //       href: '/docs/code-execution/python',
  //     },
  //     {
  //       title: '* Streaming'
  //       href: '/docs/code-execution/streaming',
  //     },
  //     {
  //       title: '* Web frameworks',
  //       links: [
  //         {
  //           title: '* Next.js',
  //           href: '/docs/code-execution/python',
  //         },
  //         {
  //           title: '* React',
  //           href: '/docs/code-execution/python',
  //         },
  //         {
  //           title: '* Svelte',
  //           href: '/docs/code-execution/python',
  //         },
  //         {
  //           title: '* Vue.js',
  //           href: '/docs/code-execution/python',
  //         },
  //         {
  //           title: '* Streamlit',
  //           href: '/docs/code-execution/python',
  //         },
  //         {
  //           title: '* Gradio',
  //           href: '/docs/code-execution/python',
  //         },
  //       ],
  //     },
  //   ],
  // },
  {
    title: 'Sandbox',
    items: [
      {
        title: 'Lifecycle',
        href: '/docs/sandbox',
      },
      {
        title: 'Metadata',
        href: '/docs/sandbox/metadata',
      },
      {
        title: 'Environment variables',
        href: '/docs/sandbox/environment-variables',
      },
      {
        title: 'List running sandboxes',
        href: '/docs/sandbox/list',
      },
      {
        title: 'Connect to running sandbox',
        href: '/docs/sandbox/connect',
      },
      {
        title: 'Internet access',
        href: '/docs/sandbox/internet-access',
      },
      // {
      //   title: '* Request timeouts',
      //   href: '/docs/sandbox/request-timeouts',
      // },
      // {
      //   title: '* Persistence',
      //   href: '/docs/sandbox/persistence',
      // },
    ],
  },
  {
    title: 'Templates',
    items: [
      {
        title: 'Sandbox customization',
        href: '/docs/sandbox-template',
      },
      {
        title: 'Customize CPU & RAM',
        href: '/docs/sandbox-template/customize-cpu-ram',
      },
    ],
  },
  {
    title: 'Filesystem',
    items: [
      {
        title: 'Overview',
        href: '/docs/filesystem',
      },
      {
        title: 'Read & write',
        href: '/docs/filesystem/read-write',
      },
      {
        title: 'Watch directory for changes',
        href: '/docs/filesystem/watch',
      },
      {
        title: 'Upload data',
        href: '/docs/filesystem/upload',
      },
      {
        title: 'Download data',
        href: '/docs/filesystem/download',
      },
    ],
  },
  {
    title: 'Commands',
    items: [
      {
        title: 'Overview',
        href: '/docs/commands',
      },
      {
        title: 'Streaming',
        href: '/docs/commands/streaming',
      },
      {
        title: 'Run commands in background',
        href: '/docs/commands/background',
      },
    ],
  },
  // {
  //   title: '* Async Python SDK',
  //   items: [
  //     {
  //       title: '* Overview',
  //       href: '/docs/sdk/overview',
  //     },
  //   ]
  // },
  // {
  //   title: '* Limits',
  //   items: [
  //     {
  //       title: '* Sandbox',
  //       href: '/docs/limits/sandbox',
  //     },
  //     {
  //       title: '* Filesystem',
  //       href: '/docs/limits/overview',
  //     },
  //     {
  //       title: '* File upload & download',
  //       href: '/docs/limits/file-upload-download',
  //     },
  //   ]
  // },
  // {
  //   title: '* Latency',
  //   items: [
  //     {
  //       title: '* Start times',
  //       href: '/docs/latency/start-times',
  //     },
  //     {
  //       title: '* Sandbox operations',
  //       href: '/docs/latency/sandbox-operations',
  //     },
  //   ]
  // },
  {
    title: 'CLI',
    items: [
      {
        title: 'Installation',
        href: '/docs/cli',
      },
      {
        title: 'Authentication',
        href: '/docs/cli/auth',
      },
      {
        title: 'List running sandboxes',
        href: '/docs/cli/list-sandboxes',
      },
      {
        title: 'Shutdown running sandboxes',
        href: '/docs/cli/shutdown-sandboxes',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    items: [
      {
        title: 'Templates',
        links: [
          {
            title: 'Build authentication error',
            href: '/docs/troubleshooting/templates/build-authentication-error',
          },
        ],
      },
    ],
  },
  // {
  //   // Maybe move integrations to a separate docs page?
  //   title: 'Integrations',
  //   items: [
  //     {
  //       title: 'OpenAI',
  //       href: '/docs/integrations/openai',
  //     },
  //     {
  //       title: 'Vercel AI SDK',
  //       href: '/docs/integrations/ai-sdk',
  //     },
  //     {
  //       title: 'Langchain',
  //       href: '/docs/integrations/ai-sdk',
  //     },
  //   ]
  // },
]

export const apiRefRoutes: NavGroup[] = apiRefRoutesJson
