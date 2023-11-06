'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'

import { useIsInsideMobileNavigation } from '@/components/MobileNavigation'
import { useSectionStore } from '@/components/SectionProvider'
import { Tag } from '@/components/Tag'
import { remToPx } from '@/lib/remToPx'
import { Auth } from '@/components/Auth'
import { Feedback } from '@/components/Feedback'
import { routes } from './routes'

interface NavGroup {
  title: string
  links: Array<{
    title: string
    href: string
  }>
}

function useInitialValue<T>(value: T, condition = true) {
  const initialValue = useRef(value).current
  return condition ? initialValue : value
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TopLevelNavItem({
                           href,
                           children,
                         }: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li className="md:hidden">
      <Link
        href={href}
        className="block py-1 text-sm text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        {children}
      </Link>
    </li>
  )
}

function NavLink({
                   className,
                   href,
                   children,
                   tag,
                   icon,
                   active = false,
                   isAnchorLink = false,
                   isFontMono = false,
                 }: {
  className?: string
  href: string
  children: React.ReactNode
  tag?: string
  active?: boolean
  icon?: React.ReactNode
  isAnchorLink?: boolean
  isFontMono?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex justify-between gap-2 py-1 pr-3 text-sm transition',
        isAnchorLink ? 'pl-7' : 'pl-4',
        active
          ? 'text-zinc-900 dark:text-white'
          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
        isFontMono ? 'font-mono text-xs' : '',
        className,
      )}
    >
      <div className="flex items-center justify-start gap-1">
        {icon}
        {tag ? (
          <div className="flex items-center gap-2">
            <Tag
              variant="small"
              color="emerald"
            >
              {tag}
            </Tag>
            <span className={clsx('truncate', active ? 'text-white' : '')}>
              {children}
            </span>
          </div>
        ) : (
          <span className={clsx('truncate', active ? 'text-white' : '')}>{children}</span>
        )}
      </div>
    </Link>
  )
}

function VisibleSectionHighlight({ group, pathname }) {
  const [sections, visibleSections] = useInitialValue(
    [useSectionStore(s => s.sections), useSectionStore(s => s.visibleSections)],
    useIsInsideMobileNavigation(),
  )

  const isPresent = useIsPresent()
  const firstVisibleSectionIndex = Math.max(
    0,
    [{ id: '_top' }, ...sections].findIndex(section => section.id === visibleSections[0]),
  )
  const itemHeight = remToPx(2)
  const height = isPresent ? Math.max(1, visibleSections.length) * itemHeight : itemHeight
  const activePageIndex = activeGroupIndex(group, pathname)
  const top = activePageIndex * itemHeight + firstVisibleSectionIndex * itemHeight

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      className="absolute inset-x-0 top-0 bg-zinc-800/5 will-change-transform dark:bg-white/5"
      style={{ borderRadius: 8, height, top }}
    />
  )
}

function ActivePageMarker({ group, pathname }: { group: NavGroup; pathname: string }) {
  const itemHeight = remToPx(2)
  const offset = remToPx(0.25)
  const activePageIndex = activeGroupIndex(group, pathname)
  const top = offset + activePageIndex * itemHeight

  return (
    <motion.div
      layout
      className="absolute left-2 h-6 w-px bg-brand-500"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      style={{ top }}
    />
  )
}

function NavigationGroup({ group, className }) {
  // If this is the mobile navigation then we always render the initial
  // state, so that the state does not change during the close animation.
  // The state will still update when we re-open (re-render) the navigation.
  const isInsideMobileNavigation = useIsInsideMobileNavigation()
  let initialPathname = usePathname()

  // Running on the server, there's bug with usePathname() and basePath https://github.com/vercel/next.js/issues/52700
  if (typeof window === 'undefined' && initialPathname === '/') initialPathname = '/docs'

  const [pathname, sections] = useInitialValue(
    [initialPathname, useSectionStore(s => s.sections)],
    isInsideMobileNavigation,
  )
  const isActiveGroup = activeGroupIndex(group, pathname) !== -1

  return (
    <li className={clsx('relative mt-6', className)}>
      <motion.h2
        layout="position"
        className="text-sm font-semibold text-zinc-900 dark:text-white"
      >
        {group.title}
      </motion.h2>
      <div className="relative mt-3 pl-2">
        <AnimatePresence initial={!isInsideMobileNavigation}>
          {isActiveGroup && (
            <VisibleSectionHighlight
              group={group}
              pathname={pathname}
            />
          )}
        </AnimatePresence>
        <motion.div
          layout
          className="absolute inset-y-0 left-2 w-px bg-zinc-900/10 dark:bg-white/5"
        />
        <AnimatePresence initial={false}>
          {isActiveGroup && (
            <ActivePageMarker
              group={group}
              pathname={pathname}
            />
          )}
        </AnimatePresence>
        <ul
          role="list"
          className="border-l border-transparent"
        >
          {group.links.map(link => (
            <motion.li
              key={link.href}
              layout="position"
              className="relative"
            >
              {/* @ts-ignore */}
              <NavLink
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
              </NavLink>
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
                        {/* @ts-ignore */}
                        <NavLink
                          href={`${link.href}#${section.id}`}
                          tag={section.tag}
                          icon={section.icon}
                          isAnchorLink
                        >
                          {section.title}
                        </NavLink>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </ul>
      </div>
    </li>
  )
}


export function Navigation(props) {
  return (
    <nav {...props}>
      <ul role="list">
        {/* <TopLevelNavItem href="/">API</TopLevelNavItem>
        <TopLevelNavItem href="#">Documentation</TopLevelNavItem>
        <TopLevelNavItem href="#">Support</TopLevelNavItem> */}
        {routes.map((group, groupIndex) => (
          <NavigationGroup
            key={group.title}
            group={group}
            className={groupIndex === 0 && 'md:mt-0'}
          />
        ))}
        <li className="z-10 mt-6">
          <Feedback className="w-full"/>
        </li>
        <li
          /* -1.5rem to stretch outside the padding of the parent list */
          className="
            sticky bottom-[-1.5rem] z-10 mx-[-1.5rem] mt-[1.5rem] py-3
            backdrop-blur-lg backdrop-filter
            min-[540px]:hidden
          "
        >
          <Auth/>
        </li>
      </ul>
    </nav>
  )
}

function activeGroupIndex(group: NavGroup, pathname: string) {
  return group.links.findIndex(link => {
    if (link.href === '/' && pathname === '/docs') return true // special case for index
    return `/docs${link.href}` === pathname
  })
}
