'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  motion,
  // useIsPresent,
} from 'framer-motion'

import { useIsInsideMobileNavigation } from '@/components/MobileNavigation'
import { useSectionStore } from '@/components/SectionProvider'
// import { remToPx } from '@/lib/remToPx'
import {
  routes,
  NavGroup,
  NavSubgroup,
  NavLink,
} from './routes'
import { NavigationSubgroup } from './NavigationSubgroup'
import { NavigationLink } from './NavigationLink'

// interface NavGroup {
//   title: string
//   links: Array<{
//     title: string
//     href: string
//   }>
// }

function useInitialValue<T>(value: T, condition = true) {
  const initialValue = useRef(value).current
  return condition ? initialValue : value
}

// function VisibleSectionHighlight({ group, pathname }) {
//   const [sections, visibleSections] = useInitialValue(
//     [useSectionStore(s => s.sections), useSectionStore(s => s.visibleSections)],
//     useIsInsideMobileNavigation(),
//   )

//   const isPresent = useIsPresent()
//   const firstVisibleSectionIndex = Math.max(
//     0,
//     [{ id: '_top' }, ...sections].findIndex(section => section.id === visibleSections[0]),
//   )
//   const itemHeight = remToPx(2)
//   const height = isPresent ? Math.max(1, visibleSections.length) * itemHeight : itemHeight
//   const activePageIndex = activeGroupIndex(group, pathname)
//   const top = activePageIndex * itemHeight + firstVisibleSectionIndex * itemHeight

//   return (
//     <motion.div
//       layout
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1, transition: { delay: 0.2 } }}
//       exit={{ opacity: 0 }}
//       className="absolute inset-x-0 top-0 bg-zinc-800/5 will-change-transform dark:bg-white/5"
//       style={{ borderRadius: 8, height, top }}
//     />
//   )
// }

// function ActivePageMarker({ group, pathname }: { group: NavGroup; pathname: string }) {
//   const itemHeight = remToPx(2)
//   const offset = remToPx(0.25)
//   const activePageIndex = activeGroupIndex(group, pathname)
//   const top = offset + activePageIndex * itemHeight

//   return (
//     <motion.div
//       layout
//       className="absolute left-2 h-6 w-px bg-brand-500"
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1, transition: { delay: 0.2 } }}
//       exit={{ opacity: 0 }}
//       style={{ top }}
//     />
//   )
// }

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

  // const isActiveGroup = activeGroupIndex(group, pathname) !== -1

  return (
    <li className={clsx('relative', className)}>
      <motion.h2
        layout="position"
        className="pl-2 text-2xs font-medium text-white mb-1"
      >
        {group.title}
      </motion.h2>
      <div className="relative">
        {/* <AnimatePresence initial={!isInsideMobileNavigation}>
          {isActiveGroup && (
            <VisibleSectionHighlight
              group={group}
              pathname={pathname}
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {isActiveGroup && (
            <ActivePageMarker
              group={group}
              pathname={pathname}
            />
          )}
        </AnimatePresence> */}
        <ul
          role="list"
          className="border-l border-transparent"
        >
          <>
            {group.items?.map(item => (
              <>
                {(item as any).links ? (
                  <NavigationSubgroup subgroup={item as NavSubgroup} />
                ) : (
                  <NavigationLink
                    link={item as NavLink}
                    className="font-medium"
                  // href={item.href}
                  // active={
                  //   `/docs${item.href}` === pathname ||
                  //   // Special case for index (/)
                  //   (item.href == '/' && pathname == '/docs')
                  // }
                  // tag={item.tag}
                  />
                )}
              </>
            ))}

            {/* {group.links?.map(link => (
              <motion.li
                key={link.href}
                layout="position"
                className="relative"
              >
                <NavigationLink
                  className="font-medium"
                  href={link.href}
                  active={
                    `/docs${link.href}` === pathname ||
                    // Special case for index (/)
                    (link.href == '/' && pathname == '/docs')
                  }
                  isFontMono={link.isFontMono}
                  icon={link.icon}
                  tag={link.tag}
                >
                  {link.title}
                </NavigationLink>
                <AnimatePresence
                  mode="popLayout"
                  initial={false}
                >
                  {`/docs${link.href}` === pathname && sections.length > 0 && (
                    <motion.ul
                      role="list"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        transition: { delay: 0.1 },
                      }}
                      exit={{
                        opacity: 0,
                        transition: { duration: 0.15 },
                      }}
                    >
                      {sections.map(section => (
                        <li key={section.id}>
                          <NavigationLink
                            href={`${link.href}#${section.id}`}
                            tag={section.tag}
                            icon={section.icon}
                            isAnchorLink
                          >
                            {section.title}
                          </NavigationLink>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.li>
            ))} */}
          </>
        </ul>
      </div>
      {!isLast && (
        <div className="ml-2 h-px bg-white/5 my-4"></div>
      )}
    </li>
  )
}

export function Navigation(props) {
  return (
    <nav {...props}>
      <ul role="list">
        {routes.map((group, groupIndex) => (
          <NavigationGroup
            key={group.title}
            group={group}
            className={groupIndex === 0 ? 'md:mt-0' : undefined}
            isLast={groupIndex === routes.length - 1}
          />
        ))}
      </ul>
    </nav>
  )
}

// function activeGroupIndex(group: NavGroup, pathname: string) {
//   return group.items.findIndex(item => {
//     return item.href === pathname
//   })
// }
