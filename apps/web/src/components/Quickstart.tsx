import {
  BrainCircuit,
  UploadCloud,
  PlayCircle,
  PackagePlus,
} from 'lucide-react'

import { BoxItem, BoxGrid } from '@/components/DocsBox'

const items: BoxItem[] = [
  {
    href: '/docs/quickstart',
    title: 'Running your first Sandbox',
    description:
      'Learn how to start your first E2B Sandbox with our Python or JavaScript SDK.',
    icon: (
      <PlayCircle
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
  {
    href: '/docs/quickstart/connect-llms',
    title: 'Connecting LLMs to E2B',
    description:
      'Connect your favorite LLM to E2B to run AI-generated code inside the Sandbox.',
    icon: (
      <BrainCircuit
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
  {
    href: '/docs/quickstart/upload-download-files',
    title: 'Uploading & downloading files',
    description:
      'A quick guide on how to upload and download files to and from the Sandbox.',
    icon: (
      <UploadCloud
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
  {
    href: '/docs/quickstart/install-custom-packages',
    title: 'Install custom packages',
    description: 'Customize your Sandbox with third-party packages.',
    icon: (
      <PackagePlus
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
]

export function Quickstart() {
  return <BoxGrid items={items} />
}
