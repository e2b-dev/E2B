import {
  Boxes,
  Braces,
  ChevronRightSquare,
  Cpu,
  DollarSign,
  FileDown,
  File,
  FileUp,
  Folder,
  FolderTree,
  Hammer,
  HeartHandshake,
  KeyRound,
  Link,
  PencilRuler,
  PlaySquare,
  RefreshCw,
  Settings,
  ShieldQuestion,
  TerminalSquare,
  Timer,
  Variable,
} from 'lucide-react'

import logoOpenAI from '@/images/logos/openai.svg'
import Image from 'next/image'

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
        title: 'Guide: Custom Code Interpreter',
        href: '/guide/simple-gpt4-code-interpreter',
        //
        // title: 'Hello World: Simple AI Junior Developer',
        // href: '/guide/simple-ai-junior-developer',
      },
      // {
      //   icon: (
      //     <Hammer
      //       strokeWidth={1}
      //       size={20}
      //     />
      //   ),
      //   title: 'Guide: Run LLM-generated code',
      //   href: '/guide/simple-gpt4-code-interpreter',
      //   //
      //   // title: 'Hello World: Simple AI Junior Developer',
      //   // href: '/guide/simple-ai-junior-developer',
      // },
    ],
  },
  {
    title: 'LLM Platforms',
    links: [
      {
        icon: (
          <Image
            src={logoOpenAI}
            alt="OpenAI logo"
            className="h-4 w-4"
          />
        ),
        title: 'OpenAI',
        href: '/llm-platforms/openai',
      },
    ],
  },
  {
    title: 'Sandbox',
    links: [
      {
        title: 'Overview',
        href: '/sandbox/overview',
      },
      {
        icon: (
          <Cpu
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Resources',
        href: '/sandbox/resources',
      },
      {
        icon: (
          <PencilRuler
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Customization',
        href: '/sandbox/custom',
      },
    ],
  },
  {
    title: 'Custom Sandboxes',
    links: [
      {
        title: 'Overview',
        href: '/sandbox/templates/overview',
      },
      {
        icon: (
          <File
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Template File',
        href: '/sandbox/templates/template-file',
      },
      {
        icon: (
          <PlaySquare
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Start Command',
        href: '/sandbox/templates/start-cmd',
      },
      {
        icon: (
          <Boxes
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Premade Sandboxes',
        href: '/sandbox/templates/premade',
      },
      {
        icon: (
          <Hammer
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Guide: Creating Custom Sandbox',
        href: '/guide/custom-sandbox',
      },
    ]
  },
  {
    title: 'Sandbox API',
    links: [
      {
        icon: (
          <Variable
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Environment Variables',
        href: '/sandbox/api/envs',
      },
      {
        icon: (
          <FolderTree
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Filesystem',
        href: '/sandbox/api/filesystem',
      },
      {
        icon: (
          <ChevronRightSquare
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Process',
        href: '/sandbox/api/process',
      },
      {
        icon: (
          <Folder
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Working Directory',
        href: '/sandbox/api/cwd',
      },
      {
        icon: (
          <Link
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Sandbox URL',
        href: '/sandbox/api/url',
      },
      {
        icon: (
          <FileUp
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Upload Files',
        href: '/sandbox/api/upload',
      },
      {
        icon: (
          <FileDown
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Download Files',
        href: '/sandbox/api/download',
      },
      {
        icon: (
          <Timer
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Timeouts',
        href: '/sandbox/api/timeouts',
      },
      {
        icon: (
          <RefreshCw
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Connect to running sandbox',
        href: '/sandbox/api/reconnect',
      },
      {
        icon: (
          <Braces
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Sandbox metadata',
        href: '/sandbox/api/metadata',
      },
    ],
  },
  {
    title: 'CLI API',
    links: [
      {
        icon: (
          <Settings
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Installation',
        href: '/cli/installation',
      },
      {
        icon: (
          <TerminalSquare
            strokeWidth={1}
            size={20}
          />
        ),
        title: 'Commands',
        href: '/cli/commands',
      },
    ],
  },
]
