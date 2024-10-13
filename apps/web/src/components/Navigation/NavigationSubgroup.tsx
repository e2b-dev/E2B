import { useState } from 'react'
import { NavSubgroup } from './routes'
import { NavigationLink } from './NavigationLink'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function NavigationSubgroup({ subgroup }: { subgroup: NavSubgroup }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div>
      <button
        onClick={toggleExpand}
        className="group flex items-center justify-between w-full text-left px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <h3 className="text-sm font-medium text-zinc-400 group-hover:text-white">{subgroup.title}</h3>
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
