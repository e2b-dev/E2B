'use client'

import { forwardRef, useEffect } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { motion, useScroll, useTransform } from 'framer-motion'
import { MobileNavigation, useIsInsideMobileNavigation, useMobileNavigationStore } from '@/components/MobileNavigation'
import { Logo } from '@/components/Logo'
import { MobileSearch, Search } from '@/components/Search'
import { Auth } from '@/components/Auth'
import { HeaderSeparator } from '@/components/HeaderUtils'
import { useLocalStorage } from 'usehooks-ts'
import { GitHubIcon } from '@/components/icons/GitHubIcon'

import dynamic from 'next/dynamic'
import { config } from '../../config'
import { usePathname } from 'next/navigation'

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
  const isDocs = pathname?.startsWith('/docs')
  const isAuth = pathname?.startsWith('/auth')


  useEffect(() => {
    fetch(config.github.api)
      .then(response => response.json())
      .then(data => setGithubStars(data.stargazers_count))
      .catch(() => setGithubStars(null))
  }, [setGithubStars])

  return (
    <motion.div
      // @ts-ignore
      ref={ref}
      className={clsx(
        className,
        'fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-12 px-4 transition sm:px-6 lg:z-30 lg:px-8',
        !isInsideMobileNavigation && 'backdrop-blur-sm dark:backdrop-blur',
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
          'bg-zinc-900/7.5 dark:bg-white/7.5',
        )}
      />
      <div className="relative top-1 hidden items-start justify-start lg:flex">
        <Link
          href="/"
          aria-label="Home"
        >
          <Logo className="h-6" />
        </Link>
      </div>
      {isDocs && <Search />}
      <div className="flex items-center gap-5 lg:hidden">
        <MobileNavigation />
        <Link
          href="/"
          aria-label="Home"
        >
          <Logo className="h-6" />
        </Link>
      </div>
      {!isAuth && <div className="flex items-center gap-4">
        <nav className="hidden md:block">
          <ul
            role="list"
            className="flex items-center gap-4"
          >
            <TopLevelNavItem
              href={config.github.url}
              stat={githubStars}
              statType="githubStars"
              icon={<GitHubIcon className="h-5 w-5 fill-current" />}
            />
          </ul>
        </nav>
        <HeaderSeparator />
        <MobileSearch />
        <div className="hidden min-[540px]:contents">
          <Link className='hover:text-white hover:cursor-pointer text-sm text-neutral-400' href='/docs'>
            Docs
          </Link>
          <Link className='hover:text-white hover:cursor-pointer text-sm text-neutral-400' href='/dashboard'>
            Dashboard
          </Link>
          <HeaderSeparator />
          <Auth />
        </div>
      </div>
      }
    </motion.div>
  )
})
