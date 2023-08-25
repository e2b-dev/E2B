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

interface NavGroup {
  title: string
  links: Array<{
    title: string
    href: string
  }>
}

function useInitialValue<T>(value: T, condition = true) {
  let initialValue = useRef(value).current
  return condition ? initialValue : value
}

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
  href,
  children,
  tag,
  active = false,
  isAnchorLink = false,
  isFontMono = false,
}: {
  href: string
  children: React.ReactNode
  tag?: string
  active?: boolean
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
        isFontMono ? 'font-mono text-xs' : ''
      )}
    >
      <span className="truncate">{children}</span>
      {tag && (
        <Tag variant="small" color="zinc">
          {tag}
        </Tag>
      )}
    </Link>
  )
}

function VisibleSectionHighlight({ group, pathname }) {
  let [sections, visibleSections] = useInitialValue(
    [
      useSectionStore((s) => s.sections),
      useSectionStore((s) => s.visibleSections),
    ],
    useIsInsideMobileNavigation()
  )

  let isPresent = useIsPresent()
  let firstVisibleSectionIndex = Math.max(
    0,
    [{ id: '_top' }, ...sections].findIndex(
      (section) => section.id === visibleSections[0]
    )
  )
  let itemHeight = remToPx(2)
  let height = isPresent
    ? Math.max(1, visibleSections.length) * itemHeight
    : itemHeight
  let activePageIndex = activeGroupIndex(group, pathname)
  let top = activePageIndex * itemHeight + firstVisibleSectionIndex * itemHeight

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      className="absolute inset-x-0 top-0 bg-zinc-800/2.5 will-change-transform dark:bg-white/2.5"
      style={{ borderRadius: 8, height, top }}
    />
  )
}

function ActivePageMarker({
  group,
  pathname,
}: {
  group: NavGroup
  pathname: string
}) {
  let itemHeight = remToPx(2)
  let offset = remToPx(0.25)
  let activePageIndex = activeGroupIndex(group, pathname)
  let top = offset + activePageIndex * itemHeight

  return (
    <motion.div
      layout
      className="absolute left-2 h-6 w-px bg-emerald-500"
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
  let isInsideMobileNavigation = useIsInsideMobileNavigation()
  let initialPathname = usePathname();

  // Running on the server, there's bug with usePathname() and basePath https://github.com/vercel/next.js/issues/52700
  if (typeof window === 'undefined' && initialPathname === '/') initialPathname = '/docs'

  let [pathname, sections] = useInitialValue(
    [initialPathname, useSectionStore((s) => s.sections)],
    isInsideMobileNavigation
  )

  let isActiveGroup = activeGroupIndex(group, pathname) !== -1

  return (
    <li className={clsx('relative mt-6', className)}>
      <motion.h2
        layout="position"
        className="text-xs font-semibold text-zinc-900 dark:text-white"
      >
        {group.title}
      </motion.h2>
      <div className="relative mt-3 pl-2">
        <AnimatePresence initial={!isInsideMobileNavigation}>
          {isActiveGroup && (
            <VisibleSectionHighlight group={group} pathname={pathname} />
          )}
        </AnimatePresence>
        <motion.div
          layout
          className="absolute inset-y-0 left-2 w-px bg-zinc-900/10 dark:bg-white/5"
        />
        <AnimatePresence initial={false}>
          {isActiveGroup && (
            <ActivePageMarker group={group} pathname={pathname} />
          )}
        </AnimatePresence>
        <ul role="list" className="border-l border-transparent">
          {group.links.map((link) => (
            <motion.li key={link.href} layout="position" className="relative">
              {/* @ts-ignore */}
              <NavLink
                href={link.href}
                active={`/docs${link.href}` === pathname}
                isFontMono={link.isFontMono}
              >
                {link.title}
              </NavLink>
              <AnimatePresence mode="popLayout" initial={false}>
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
                    {sections.map((section) => (
                      <li key={section.id}>
                        {/* @ts-ignore */}
                        <NavLink
                          href={`${link.href}#${section.id}`}
                          tag={section.tag}
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

export const navigation = [
  {
    title: 'Introduction',
    links: [
      { title: 'What is E2B?', href: '/' },
      { title: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Getting Started',
    links: [
      { title: 'Installation', href: '/getting-started/installation' },
      { title: 'API Key', href: '/getting-started/api-key' },
      { title: 'SDK Basics', href: '/getting-started/basics' },
    ],
  },
  {
    title: 'AI Playgrounds',
    links: [
      { title: 'Overview', href: '/playgrounds/overview' },
      { title: 'Limitations', href: '/playgrounds/limitations' },
      // { title: 'Use with AI Agents & Copilots', href: '/getting-started/how-to' },
    ],
  },
  // {
  //   title: 'AI Environments',
  //   links: [
  //     { title: 'Overview', href: '/env/overview' },
  //     { title: 'Customization', href: '/env/customization' },
  //     { title: 'Secrets', href: '/env/secrets' },
  //   ],
  // },
  // {
  //   title: 'Examples',
  //   links: [
  //     { title: 'Dynamically install dependencies', href: '/examples/deps' },
  //     { title: 'Clone GitHub Repository', href: '/examples/clone-repo' },
  //     { title: 'Run Any Code', href: '/examples/run-code' },
  //     { title: 'Get Output From Linter', href: '/examples/linter' },
  //     { title: 'Static Code Analysis', href: '/examples/static-code-analysis' },
  //     { title: 'Run Headless Chrome', href: '/examples/headless-chrome' },
  //   ],
  // },
  // {
  //   title: 'Use Cases',
  //   links: [
  //     { title: 'Overview', href: '/use-cases/overview' },
  //     { title: 'Coding Copilot', href: '/use-cases/coding' },
  //     { title: 'Data Analytics Copilot', href: '/use-cases/data-analytics' },
  //     { title: 'Research Copilot', href: '/use-cases/research' },
  //     { title: 'Productivity Copilot', href: '/use-cases/productivity' },
  //     { title: 'Code Interpreter', href: '/use-cases/code-interpreter' },
  //   ],
  // },
  // {
  //   title: 'Usage with Frameworks (Remove?)',
  //   links: [
  //     { title: 'LangChain', href: '/use-cases/coding' },
  //     { title: 'OpenAI', href: '/use-cases/coding' },
  //     { title: 'HugginFace', href: '/use-cases/coding' },
  //     { title: 'Python', href: '/use-cases/coding' },
  //     { title: 'TypeScript', href: '/use-cases/coding' },
  //   ],
  // },
  // {
  // title: 'SDK Reference',
  // links: [
  // { title: 'E2B', href: '/reference/e2b', isFontMono: true },

  // Primitives
  // { title: 'e2b.process', href: '/reference/python/process', isFontMono: true },
  // { title: 'e2b.filesystem', href: '/reference/python/filesystem', isFontMono: true },
  // { title: 'e2b.http', href: '/reference/python/http', isFontMono: true },
  // { title: 'e2b.code', href: '/reference/python/code', isFontMono: true },

  // High-level modules
  // { title: 'e2b.code', href: '/reference/code', isFontMono: true },
  // { title: 'e2b.browser', href: '/reference/browser', isFontMono: true },
  // { title: 'e2b.chart', href: '/reference/chart', isFontMono: true },
  // { title: 'e2b.storage', href: '/reference/storage', isFontMono: true },
  // { title: 'e2b.auth', href: '/reference/auth', isFontMono: true },
  // { title: 'e2b.datasource', href: '/reference/data', isFontMono: true },
  // { title: 'e2b.skills', href: '/reference/skills', isFontMono: true },
  // { title: 'e2b.spreadsheet', href: '/reference/spreadsheet', isFontMono: true },
  // ],
  // },
]

export function Navigation(props) {
  return (
    <nav {...props}>
      <ul role="list">
        <TopLevelNavItem href="/">API</TopLevelNavItem>
        <TopLevelNavItem href="#">Documentation</TopLevelNavItem>
        <TopLevelNavItem href="#">Support</TopLevelNavItem>
        {navigation.map((group, groupIndex) => (
          <NavigationGroup
            key={group.title}
            group={group}
            className={groupIndex === 0 && 'md:mt-0'}
          />
        ))}
        <li className="sticky bottom-0 z-10 mt-6">
          <Feedback variant="secondary" className="w-full" />
        </li>
        <li className="sticky bottom-0 z-10 mt-6 min-[540px]:hidden">
          <Auth />
        </li>
      </ul>
    </nav>
  )
}

function activeGroupIndex(group: NavGroup, pathname: string) {
  return group.links.findIndex((link) => {
    if (link.href === `/` && pathname === `/docs`) return true // special case for index
    return `/docs${link.href}` === pathname
  })
}
