'use client'

import React, { useRef } from 'react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  motion,
} from 'framer-motion'

import { useIsInsideMobileNavigation } from '@/components/MobileBurgerMenu'
import { useSectionStore } from '@/components/SectionProvider'
import {
  routes,
  NavGroup,
  NavSubgroup,
  NavLink,
} from './routes'
import { NavigationSubgroup } from './NavigationSubgroup'
import { NavigationLink } from './NavigationLink'


function useInitialValue<T>(value: T, condition = true) {
  const initialValue = useRef(value).current
  return condition ? initialValue : value
}

function NavigationGroup({ group, className, isLast }: { group: NavGroup; className?: string; isLast?: boolean }) {
  // If this is the mobile navigation then we always render the initial
  // state, so that the state does not change during the close animation.
  // The state will still update when we re-open (re-render) the navigation.
  const isInsideMobileNavigation = useIsInsideMobileNavigation()
  const initialPathname = usePathname()
  const [pathname] = useInitialValue(
    [initialPathname, useSectionStore(s => s.sections)],
    isInsideMobileNavigation,
  )
  if (!pathname) {
    return null
  }

  return (
    <li className={clsx('relative pr-2', className)}>
      <div className="pl-2 mb-1 flex items-center justify-start gap-1">
        <motion.h2
          layout="position"
          className="text-2xs font-medium text-white"
        >
          {group.title}
        </motion.h2>
      </div>
      <div className="relative">
        <ul
          role="list"
          className="border-l border-transparent"
        >
          <>
            {group.items?.map(item => (
              <React.Fragment key={item.title}>
                {(item as any).links ? (
                  <NavigationSubgroup subgroup={item as NavSubgroup} />
                ) : (
                  <NavigationLink
                    link={item as NavLink}
                    className="font-medium"
                  />
                )}
              </React.Fragment>
            ))}
          </>
        </ul>
      </div>
      {!isLast && (
        // Visual separator
        <div className="ml-2 h-px bg-white/5 my-4"></div>
      )}
    </li>
  )
}

export function Navigation(props) {
  return (
    <nav {...props} className="border-r border-white/10 lg:pb-4">
      <ul role="list">
        {routes.map((group, groupIndex) => (
          <NavigationGroup
            key={groupIndex}
            group={group}
            className={groupIndex === 0 ? 'md:mt-0' : undefined}
            isLast={groupIndex === routes.length - 1}
          />
        ))}
      </ul>
    </nav>
  )
}
