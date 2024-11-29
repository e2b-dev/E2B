import Link from 'next/link'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  console.log(pathname, href)
  const isActive = pathname === href
  return (
    <Link href={href} className={clsx(
      'text-xs flex items-center gap-2 group p-1 transition-all',
    )}>
      <div className={clsx(
        'flex items-center justify-center p-2 rounded-md bg-gradient-to-b shadow-md group-hover:from-brand-800 group-hover:to-brand-400 border border-white/20 group-hover:border-brand-400',
        isActive ? 'from-brand-800 to-brand-400 border-brand-400' : 'from-gray-700 to-gray-900 border-white/20'
      )}>
        {icon}
      </div>
      <span className={clsx(
        'font-semibold',
        isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'
      )}>{title}</span>
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
