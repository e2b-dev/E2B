import Link from 'next/link'
import { BookIcon, BracesIcon } from 'lucide-react'

function Item({
  href,
  icon,
  title,
}: {
  href: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <Link href={href} className="text-xs text-brand-400 flex items-center gap-2 group p-1 transition-all">
      <div className="flex items-center justify-center p-2 rounded-md bg-gradient-to-b from-gray-700 to-gray-900 shadow-md group-hover:bg-gradient-to-b group-hover:from-brand-800 group-hover:to-brand-400 border border-white/20 group-hover:border-brand-400">
        {icon}
      </div>
      <span className="font-semibold text-zinc-400 group-hover:text-white">{title}</span>
    </Link>
  )
}

export function DocsTypes() {
  return (
    <>
      <Item href="/docs" icon={<BookIcon className="w-4 h-4 text-white" />} title="Documentation" />
      <Item href="/docs/sdk-reference" icon={<BracesIcon className="w-4 h-4 text-white" />} title="SDK Reference" />
      <li className="h-px bg-white/5 my-4"></li>
    </>
  )
}
