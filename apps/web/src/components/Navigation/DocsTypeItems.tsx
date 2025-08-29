import Link from 'next/link'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import { BookIcon, BracesIcon } from 'lucide-react'

function Item({
  href,
  allHrefs,
  icon,
  title,
}: {
  href: string
  allHrefs: string[]
  icon: React.ReactNode
  title: string
}) {
  const pathname = usePathname()
  const bestMatch = allHrefs.find(
    (h) =>
      pathname.startsWith(h) &&
      (pathname.length === h.length || pathname.charAt(h.length) === '/')
  )

  const isActive = href === bestMatch

  return (
    <Link
      href={href}
      className={clsx(
        'text-xs flex items-center gap-2 group p-1 transition-all'
      )}
    >
      <div
        className={clsx(
          'flex items-center justify-center p-2 rounded-md bg-gradient-to-b shadow-md group-hover:from-brand-800 group-hover:to-brand-400 border border-white/20 group-hover:border-brand-400',
          isActive
            ? 'from-brand-800 to-brand-400 border-brand-400'
            : 'from-gray-700 to-gray-900 border-white/20'
        )}
      >
        {icon}
      </div>
      <span
        className={clsx(
          'font-semibold',
          isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'
        )}
      >
        {title}
      </span>
    </Link>
  )
}

export function DocsTypes() {
  return (
    <>
      {/* Order of allHrefs is important here to calculate `bestMatch` correctly! */}
      <Item
        href="/docs"
        icon={<BookIcon className="w-4 h-4 text-white" />}
        title="Documentation"
        allHrefs={['/docs/sdk-reference', '/docs']}
      />
      <Item
        href="/docs/sdk-reference"
        icon={<BracesIcon className="w-4 h-4 text-white" />}
        title="SDK Reference"
        allHrefs={['/docs/sdk-reference', '/docs']}
      />
      <li className="h-px bg-white/5 my-4"></li>
    </>
  )
}
