import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tag } from '@/components/Tag'

import { NavLink } from './routes'

export function NavigationLink({
  className,
  link,
  tag,
}: {

  className?: string
  link: NavLink
  tag?: string
}) {
  const pathname = usePathname()
  const isActive = pathname === link.href

  return (
    <Link
      href={link.href}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        'flex justify-between mb-[2px] py-1 px-2 text-sm transition rounded-md hover:bg-zinc-800 transition-colors',
        isActive
          ? 'text-white bg-zinc-800'
          : 'hover:text-white text-zinc-400 bg-transparent',
        className,
      )}
    >
      <div className="flex items-center justify-start gap-1">
        {link.icon}
        {tag ? (
          <div className="flex items-center gap-2">
            <Tag
              variant="small"
              color="emerald"
            >
              {tag}
            </Tag>
            <span className={clsx('truncate', isActive ? 'text-white' : '')}>
              {link.title}
            </span>
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