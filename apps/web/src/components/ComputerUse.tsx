import {
  Monitor,
  SquareMousePointer,
} from 'lucide-react'

import {
  BoxItem,
  BoxGrid,
} from '@/components/DocsBox'

const items: BoxItem[] = [
  {
    href: '/docs/computer-use',
    title: 'Create secure cloud desktop',
    description: 'Learn how to create a secure cloud computer with GUI using Desktop Sandbox.',
    icon: <Monitor strokeWidth={1.5} className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  },
  {
    href: '/docs/computer-use/mouse-keyboard',
    title: 'Control mouse & keyboard',
    description: 'Control mouse and keyboard of the desktop sandbox.',
    icon: <SquareMousePointer strokeWidth={1.5} className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  },
]

export function ComputerUse() {
  return <BoxGrid items={items} />
}
