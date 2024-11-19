import {
  FolderTree,
  Terminal,
  Hourglass,
  Command,
} from 'lucide-react'

import {
  BoxItem,
  BoxGrid,
} from '@/components/DocsBox'

const concepts: BoxItem[] = [
  {
    href: '/docs/sandbox',
    title: 'Sandbox lifecycle',
    description: 'Learn about how to start the sandbox, manage its lifecycle, and interact with it.',
    icon: <Hourglass strokeWidth={1.5} className="h-6 w-6 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  },
  // {
  //   href: '/docs/code-execution',
  //   title: 'AI code execution',
  //   description: 'E2B Sandboxex offer built-in support for running AI-generated Python, JS, TS, and R. You can customize sandbox to run almost any language.',
  //   icon: <Binary strokeWidth={1.5} className="h-6 w-6 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  // },
  {
    href: '/docs/filesystem',
    title: 'Filesystem',
    description: 'Each sandbox has its own isolated filesystem that you can use to create, read, write, and delete files.',
    icon: <FolderTree strokeWidth={1.5} className="h-6 w-6 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  },
  {
    href: '/docs/commands',
    title: 'Commands',
    description: 'You can run terminal commands inside the Sandbox. This allows you to start any process inside the Sandbox.',
    icon: <Command strokeWidth={1.5} className="h-6 w-6 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  },
  {
    href: '/docs/cli',
    title: 'CLI',
    description: 'E2B CLI allows you to build and manage your templates and sandboxes.',
    icon: <Terminal strokeWidth={1.5} className="h-6 w-6 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  }
]

export function Concepts() {
  return <BoxGrid items={concepts} noBackground />
}
