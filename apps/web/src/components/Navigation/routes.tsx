import {
  Braces,
  CheckCircle,
  Home,
  KeyRound,
  MessagesSquare,
} from 'lucide-react'
import sdkRefRoutesJson from './sdkRefRoutes.json'

enum Tag {
  New = 'New',
}

export interface NavLink {
  title: string
  href: string
  tag?: Tag
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

export interface VersionedNavGroup {
  title?: string
  icon?: React.ReactNode
  versionedItems: { [key: string]: Array<NavLink | NavSubgroup> }
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
        title: 'API Key',
        href: '/docs/api-key',
        icon: <KeyRound size={16} />,
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
            title: 'JavaScript and TypeScript',
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
        title: 'Lifecycle events API',
        href: '/docs/sandbox/lifecycle-events-api',
      },
      {
        title: 'Lifecycle events webhooks',
        href: '/docs/sandbox/lifecycle-events-webhooks',
      },
      {
        title: 'Persistence',
        href: '/docs/sandbox/persistence',
      },
      {
        title: 'Metrics',
        href: '/docs/sandbox/metrics',
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
        title: 'List sandboxes',
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
      {
        title: 'Connecting storage bucket',
        href: '/docs/sandbox/connect-bucket',
      },
      {
        title: 'Rate limits',
        href: '/docs/sandbox/rate-limits',
      },
      // {
      //   title: '* Request timeouts',
      //   href: '/docs/sandbox/request-timeouts',
      // },
      // {
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
        title: 'Start command',
        href: '/docs/sandbox-template/start-cmd',
      },
      {
        title: 'Ready command',
        href: '/docs/sandbox-template/ready-cmd',
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
        title: 'File & directory metadata',
        href: '/docs/filesystem/info',
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
        title: 'List sandboxes',
        href: '/docs/cli/list-sandboxes',
      },
      {
        title: 'Shutdown running sandboxes',
        href: '/docs/cli/shutdown-sandboxes',
      },
    ],
  },
  {
    title: 'Deployment',
    items: [
      {
        title: 'Bring Your Own Cloud',
        href: '/docs/byoc',
      },
    ],
  },
  {
    title: 'Migration',
    items: [
      {
        title: 'SDK v2 Migration Guide',
        href: '/docs/migration/v2',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    items: [
      {
        title: 'SDKs',
        links: [
          {
            title: 'Vercel Edge Runtime and Cloudflare Workers',
            href: '/docs/troubleshooting/sdks/workers-edge-runtime',
          },
        ],
      },
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

const sdkRefNameMap = {
  'JS-SDK': 'JavaScript SDK',
  'PYTHON-SDK': 'Python SDK',
  'DESKTOP-JS-SDK': 'Desktop JavaScript SDK',
  'DESKTOP-PYTHON-SDK': 'Desktop Python SDK',
  'CODE-INTERPRETER-JS-SDK': 'Code Interpreter JavaScript SDK',
  'CODE-INTERPRETER-PYTHON-SDK': 'Code Interpreter Python SDK',
}

export const sdkRefRoutes: VersionedNavGroup[] = (
  sdkRefRoutesJson as unknown as VersionedNavGroup[]
)
  .sort((a, b) => {
    const order = {
      CLI: 1,
      'JS-SDK': 2,
      'PYTHON-SDK': 3,
      'DESKTOP-JS-SDK': 4,
      'DESKTOP-PYTHON-SDK': 5,
    }
    const aOrder = order[a.title || ''] || 999
    const bOrder = order[b.title || ''] || 999
    return aOrder - bOrder
  })
  .map((group) => ({
    ...group,
    title:
      group?.title && sdkRefNameMap[group.title]
        ? sdkRefNameMap[group.title]
        : group.title,
  }))
