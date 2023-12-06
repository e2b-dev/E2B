'use client'

import Link from 'next/link'

import { TwitterIcon } from '@/components/icons/TwitterIcon'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { DiscordIcon } from '@/components/icons/DiscordIcon'

function SocialLink({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group"
    >
      <span className="sr-only">{children}</span>
      <Icon className="h-5 w-5 fill-zinc-700 transition group-hover:fill-zinc-900 dark:group-hover:fill-zinc-500" />
    </Link>
  )
}

function SmallPrint() {
  return (
    <div
      className="flex flex-col items-start items-center justify-between gap-5 border-t border-zinc-900/5 pt-8 dark:border-white/5 sm:flex-row">
      <div className="flex flex-col items-center justify-start lg:items-start">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          &copy; FoundryLabs, Inc. {new Date().getFullYear()}. All rights reserved.
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          548 Market Street #83122, San Francisco, CA 94104
        </p>
      </div>
      <div className="flex gap-4">
        <SocialLink
          href="https://twitter.com/e2b_dev"
          icon={TwitterIcon}
        >
          Follow us on Twitter
        </SocialLink>
        <SocialLink
          href="https://github.com/e2b-dev"
          icon={GitHubIcon}
        >
          Follow us on GitHub
        </SocialLink>
        <SocialLink
          href="https://discord.gg/U7KEcGErtQ"
          icon={DiscordIcon}
        >
          Join our Discord server
        </SocialLink>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl space-y-10 pb-16 lg:max-w-5xl">
      <SmallPrint />
    </footer>
  )
}
