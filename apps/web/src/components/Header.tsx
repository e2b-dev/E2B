'use client'

import clsx from 'clsx'
import { motion, useScroll, useTransform } from 'framer-motion'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef, useEffect } from 'react'

import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { Logo } from '@/components/Logo'
import {
  MobileBurgerMenu,
  useIsInsideMobileNavigation,
  useMobileNavigationStore,
} from '@/components/MobileBurgerMenu'
import { useLocalStorage } from 'usehooks-ts'

import { config } from '../../config'

function DocumentationTypeLink({
  pathname,
  href,
  title,
}: {
  pathname: string | null
  href: string
  title: string
}) {
  if (!pathname) return null
  return (
    <Link
      className={clsx(
        'hover:text-white hover:cursor-pointer text-sm font-medium px-2 py-1 rounded-md',
        pathname.startsWith(href)
          ? 'text-white bg-zinc-800'
          : 'text-neutral-400'
      )}
      href={href}
    >
      {title}
    </Link>
  )
}

// No SSR to avoid hydration mismatch
const TopLevelNavItem = dynamic(() => import('@/components/TopLevelNavItem'), {
  ssr: false,
})

// @ts-ignore
export const Header = forwardRef(function Header({ className }, ref) {
  const { isOpen: mobileNavIsOpen } = useMobileNavigationStore()
  const isInsideMobileNavigation = useIsInsideMobileNavigation()

  const [githubStars, setGithubStars] = useLocalStorage('github-stars', null)

  const { scrollY } = useScroll()
  const bgOpacityLight = useTransform(scrollY, [0, 72], [0.5, 0.9])
  const bgOpacityDark = useTransform(scrollY, [0, 72], [0.2, 0.8])

  const pathname = usePathname()

  useEffect(() => {
    fetch(config.github.api)
      .then((response) => response.json())
      .then((data) => setGithubStars(data.stargazers_count))
      .catch(() => setGithubStars(null))
  }, [setGithubStars])

  return (
    <motion.div
      // @ts-ignore
      ref={ref}
      className={clsx(
        className,
        'fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-12 px-4 transition sm:px-6 lg:z-30 lg:px-6',
        !isInsideMobileNavigation && 'backdrop-blur-sm dark:backdrop-blur'
      )}
      style={
        {
          '--bg-opacity-light': bgOpacityLight,
          '--bg-opacity-dark': bgOpacityDark,
        } as React.CSSProperties
      }
    >
      <div
        className={clsx(
          'absolute inset-x-0 top-full h-px transition',
          (isInsideMobileNavigation || !mobileNavIsOpen) &&
            'bg-zinc-900/7.5 dark:bg-white/7.5'
        )}
      />
      {/* Desktop logo */}
      <div className="relative top-1 hidden items-center justify-start lg:flex gap-4">
        <Link href="/" aria-label="Home">
          <Logo className="h-6" />
        </Link>
        <div className="flex items-center gap-1">
          <DocumentationTypeLink
            pathname={pathname}
            href="/docs"
            title="Documentation"
          />
        </div>
      </div>

      {/* Mobile logo + burger menu */}
      <div className="flex items-center gap-5 lg:hidden">
        <MobileBurgerMenu />
        <Link href="/" aria-label="Home">
          <Logo className="h-6" />
        </Link>
        <div className="flex items-center gap-1">
          <DocumentationTypeLink
            pathname={pathname}
            href="/docs"
            title="Documentation"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <nav className="hidden md:block">
          <ul role="list" className="flex items-center gap-4">
            <TopLevelNavItem
              href={config.github.url}
              stat={githubStars}
              statType="githubStars"
              icon={<GitHubIcon className="h-5 w-5 fill-current" />}
            />
          </ul>
        </nav>
      </div>
    </motion.div>
  )
})
