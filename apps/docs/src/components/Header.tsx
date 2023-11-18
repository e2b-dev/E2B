import { forwardRef, useEffect } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { motion, useScroll, useTransform } from 'framer-motion'
import { MobileNavigation, useIsInsideMobileNavigation, useMobileNavigationStore } from '@/components/MobileNavigation'
import { Logo } from '@/components/Logo'
import { MobileSearch, Search } from '@/components/Search'
import { Auth } from '@/components/Auth'
import { HeaderSeparator } from '@/components/HeaderUtils'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { TwitterIcon } from '@/components/icons/TwitterIcon'
import { useLocalStorage } from 'usehooks-ts'
import { GitHubIcon } from '@/components/icons/GitHubIcon'

import dynamic from 'next/dynamic'
import { config } from '../../config'

// No SSR to avoid hydration mismatch
const TopLevelNavItem = dynamic(() => import('@/components/TopLevelNavItem'), {
  ssr: false,
})

// @ts-ignore
export const Header = forwardRef(function Header({ className }, ref) {
  const { isOpen: mobileNavIsOpen } = useMobileNavigationStore()
  const isInsideMobileNavigation = useIsInsideMobileNavigation()

  const [githubStars, setGithubStars] = useLocalStorage('github-stars', null)
  const [discordUsers, setDiscordUsers] = useLocalStorage('discord-users', null)
  // TODO: Maybe add Twitter followers count?
  // const [twitterFollowers, setTwitterFollowers] = useLocalStorage(
  //   'twitter-followers',
  //   null,
  // )

  const { scrollY } = useScroll()
  const bgOpacityLight = useTransform(scrollY, [0, 72], [0.5, 0.9])
  const bgOpacityDark = useTransform(scrollY, [0, 72], [0.2, 0.8])

  useEffect(() => {
    fetch(config.github.api)
      .then(response => response.json())
      .then(data => setGithubStars(data.stargazers_count))
      .catch(() => setGithubStars(false))
  }, [setGithubStars])

  useEffect(() => {
    fetch(config.discord.api)
      .then(response => response.json())
      .then(async data => setDiscordUsers(data.presence_count))
      .catch(() => setDiscordUsers(false))
  }, [setDiscordUsers])

  // TODO: Maybe add Twitter followers count?
  // useEffect(() => {
  //   fetch(config.twitter.api)
  //     .then((response) => response.json())
  //     .then(async (data) => setTwitterFollowers(data.followers_count))
  //     .catch(() => setTwitterFollowers(false))
  //   setTwitterFollowers(155)
  // }, [])

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
      <Search />
      <div className="flex items-center gap-5 lg:hidden">
        <MobileNavigation />
        <Link
          href="/"
          aria-label="Home"
        >
          <Logo className="h-6" />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <nav className="hidden md:block">
          <ul
            role="list"
            className="flex items-center gap-4"
          >
            <TopLevelNavItem
              href={`https://discord.gg/${config.discord.slug}`}
              stat={discordUsers}
              statType="discordUsers"
              icon={<DiscordIcon className="h-5 w-5 fill-current" />}
            />
            <TopLevelNavItem
              href={config.github.url}
              stat={githubStars}
              statType="githubStars"
              icon={<GitHubIcon className="h-5 w-5 fill-current" />}
            />
            <TopLevelNavItem
              href={config.twitter.url}
              icon={<TwitterIcon className="h-5 w-5 fill-current" />}
            />
          </ul>
        </nav>
        <HeaderSeparator />
        <MobileSearch />
        <div className="hidden min-[540px]:contents">
          <Auth />
        </div>
      </div>
    </motion.div>
  )
})
