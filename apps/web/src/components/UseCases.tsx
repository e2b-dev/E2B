import { Binary } from 'lucide-react'

import { BoxItem, BoxGrid } from '@/components/DocsBox'

const useCases: BoxItem[] = [
  {
    href: '/docs/code-execution',
    title: 'Build code interpreter',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget sapien. Sed ut purus eget sapien.',
    icon: (
      <Binary
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
  {
    href: '/docs/data-analysis',
    title: 'AI data analysis',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget sapien. Sed ut purus eget sapien.',
    icon: (
      <Binary
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
]

export function UseCases() {
  return <BoxGrid items={useCases} />
}
