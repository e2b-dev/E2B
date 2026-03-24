import { FileQuestion, ChartNoAxesCombined } from 'lucide-react'

import { BoxItem, BoxGrid } from '@/components/DocsBox'

const items: BoxItem[] = [
  {
    href: '/docs/code-interpreting/analyze-data-with-ai',
    title: 'Analyze data with AI',
    description:
      'Learn how to use E2B run AI-generated code to analyze yourdata.',
    icon: (
      <FileQuestion
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
  {
    href: '/docs/code-interpreting/create-charts-visualizations',
    title: 'Create charts & visualizations',
    description: 'Create interactive charts by running Python code in E2B.',
    icon: (
      <ChartNoAxesCombined
        strokeWidth={1.5}
        className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400"
      />
    ),
  },
  // {
  //   href: '/docs/code-interpreting/connect-your-data',
  //   title: 'Connect your data',
  //   description: 'TODO: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget sapien. Sed ut purus eget sapien.',
  //   icon: <Database strokeWidth={1.5} className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  // },
  // {
  //   href: '/docs/code-interpreting/todo',
  //   title: 'Parsing code execution results',
  //   description: 'TODO: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget sapien. Sed ut purus eget sapien.',
  //   icon: <Braces strokeWidth={1.5} className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
  // },
]

export function CodeInterpreting() {
  return <BoxGrid items={items} />
}
