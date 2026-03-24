import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tag } from '@/components/Tag'

import { NavLink } from './routes'

export function NavigationLink({
  className,
  link,
}: {
  className?: string
  link: NavLink
}) {
  const pathname = usePathname()
  // Add this to get the hash
  const hash = typeof window !== 'undefined' ? window.location.hash : ''

  // Modify the isActive check to include hash comparison if needed
  const isActive =
    pathname === link.href ||
    (link.href.includes('#') && pathname + hash === link.href)
  // const pathname = usePathname()
  // console.log(link)
  // console.log(link.title, pathname, link.href)
  // const isActive = pathname === link.href

  return (
    <Link
      href={link.href}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        'flex justify-between mb-[2px] py-1 px-2 text-sm transition rounded-md hover:bg-zinc-800 transition-colors',
        isActive
          ? 'text-white bg-zinc-800'
          : 'hover:text-white text-zinc-400 bg-transparent',
        className
      )}
    >
      <div className="flex items-center justify-start gap-1 overflow-hidden">
        {link.icon}
        {link.tag ? (
          <div className="flex items-center gap-2">
            <span className={clsx('truncate', isActive ? 'text-white' : '')}>
              {link.title}
            </span>
            <Tag>{link.tag}</Tag>
          </div>
        ) : (
          <span className={clsx('truncate', isActive ? 'text-white' : '')}>
            {link.title}
          </span>
        )}
      </div>
    </Link>
  )
}
