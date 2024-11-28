import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { NavigationLink } from './NavigationLink'
import { NavSubgroup } from './routes'

export function NavigationSubgroup({ subgroup }: { subgroup: NavSubgroup }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const pathname = usePathname()

  const isActive = subgroup.links.some((link) => link.href === pathname)

  // Automatically expand the subgroup if it's active
  useEffect(() => {
    if (isActive) {
      setIsExpanded(true)
    }
  }, [isActive])

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div>
      <button
        onClick={toggleExpand}
        className={clsx(
          'group flex items-center justify-between w-full text-left px-2 py-1 rounded-md transition-colors',
          isActive
            ? 'text-white bg-zinc-800'
            : 'hover:text-white text-zinc-400 bg-transparent'
        )}
      >
        <div className="flex items-center justify-start gap-1">
          {subgroup.icon}
          <h3 className="text-sm font-medium group-hover:text-white">
            {subgroup.title}
          </h3>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 ml-2 text-zinc-400 group-hover:text-white" />
        ) : (
          <ChevronRight className="w-4 h-4 ml-2 text-zinc-400 group-hover:text-white" />
        )}
      </button>
      {isExpanded && (
        <div className="relative ml-2 mt-1">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 rounded"></div>
          <ul className="pl-4">
            {subgroup.links.map((link) => (
              <li key={link.href}>
                <NavigationLink link={link} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
