import {
  ChevronRightSquare,
  Folder,
  FolderTree,
  KeyRound,
  Settings,
  ShieldQuestion,
  Timer,
  HeartHandshake,
  DollarSign,
  Hammer,
  Cpu,
  Link,
  FileUp,
  FileDown,
  Variable,
} from 'lucide-react'

export const routes = [
  {
    title: 'Overview',
    links: [
      { title: 'Introduction', href: '/' },
      {
        icon: (
          <HeartHandshake
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Open source',
        href: '/open-source',
      },
      {
        icon: (
          <DollarSign
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Pricing',
        href: '/pricing',
      },
      {
        icon: (
          <ShieldQuestion
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Getting help',
        href: '/getting-help',
      },
    ],
  },
  {
    title: 'Getting Started',
    links: [
      {
        icon: (
          <Settings
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Installation',
        href: '/getting-started/installation',
      },
      {
        icon: (
          <KeyRound
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'API Key',
        href: '/getting-started/api-key',
      },
      {
        icon: (
          <Hammer
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Example: Run LLM-generated code',
        href: '/guide/simple-gpt4-code-interpreter',
      },
    ],
  },
  // {
  //   title: 'Sandbox Templates',
  //   links: [
  //     { title: 'Overview', href: '/sandbox/templates/overview' },
  //     { title: 'Custom Template', href: '/sandbox/templates/custom' },
  //     { title: 'Premade: Data Analysis', href: '/sandbox/templates/data-analysis' },
  //   ],
  // },
  {
    title: 'Sandbox API',
    links: [
      { title: 'Overview', href: '/sandbox/overview' },
      {
        icon: (
          <Cpu
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Sandbox Resources',
        href: '/sandbox/resources',
      },
      {
        icon: (
          <Variable
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Environment Variables',
        href: '/sandbox/envs',
      },
      {
        icon: (
          <FolderTree
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Filesystem',
        href: '/sandbox/filesystem',
      },
      {
        icon: (
          <ChevronRightSquare
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Process',
        href: '/sandbox/process',
      },
      // TODO: Remove
      // {
      //   icon: (
      //     <Binary
      //       strokeWidth={1}
      //       size={20}
      //     />
      //   ),
      //   title: 'Executing Code',
      //   href: '/sandbox/execute',
      // },
      {
        icon: (
          <Folder
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Working Directory',
        href: '/sandbox/cwd',
      },
      // {
      //   icon: (
      //     <TextQuote
      //       strokeWidth={1}
      //       size={20}
      //     />
      //   ),
      //   title: '[TODO] Streaming',
      //   href: '/sandbox/streaming',
      // },
      // {
      //   icon: (
      //     <TextQuote
      //       strokeWidth={1}
      //       size={20}
      //     />
      //   ),
      //   title: '[TODO] Debug logs',
      //   href: '/sandbox/debugging',
      // },
      {
        icon: (
          <Link
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Sandbox URL',
        href: '/sandbox/url',
      },
      {
        icon: (
          <FileUp
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Upload Files',
        href: '/sandbox/upload',
      },
      {
        icon: (
          <FileDown
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Download Files',
        href: '/sandbox/download',
      },
      {
        icon: (
          <Timer
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Timeouts',
        href: '/sandbox/timeouts',
      },
    ],
  },
  // {
  //   title: 'Guides',
  //   links: [
  //     { title: 'AI Data Analysis With GPT-4', href: '/guides/ai-data-analysis' },
  //     { title: 'GPT-4 Cloud Browser Assistant', href: '/guides/cloud-browser-assistant' },
  //     { title: 'Custom Code Interpreter', href: '/guides/custom-code-interpreter' },
  //     { title: 'GPT-controlled FFmpeg', href: '/guides/gpt-controlled-ffmpeg' }
  //   ],
  // },
  // {
  //   title: 'Framework Integrations',
  //   links: [
  //     { title: 'LangChain', href: '/integrations/framework/langchain' },
  //     { title: 'LlamaIndex', href: '/integrations/framework/llamaindex' },
  //     { title: 'Rivet', href: '/integrations/framework/rivet' },
  //     { title: 'AutoGen', href: '/integrations/framework/autogen' },
  //     { title: 'Fixie', href: '/integrations/framework/fixie' },
  //     { title: 'Hugging Face Agents', href: '/integrations/framework/hf-agents' },
  //     { title: 'AgentLabs', href: '/integrations/framework/agentlabs' },
  //     { title: 'Chainlit', href: '/integrations/framework/chainlit' },
  //     { title: 'Streamlit', href: '/integrations/framework/streamlit' },
  //     { title: 'Gradio', href: '/integrations/framework/gradio' },
  //   ],
  // },
  // {
  //   title: 'LLMs Integrations',
  //   links: [
  //     { title: 'OpenAI', href: '/integrations/llm/openai' },
  //     { title: 'Anthropic', href: '/integrations/llm/anthropic' },
  //     { title: 'Hugging Face', href: '/integrations/llm/hugging-face' },
  //     { title: 'Replicate', href: '/integrations/llm/replicate' },
  //   ],
  // },
]
