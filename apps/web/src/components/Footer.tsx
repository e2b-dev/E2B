'use client'

import Link from 'next/link'
// import { usePathname } from 'next/navigation'

// import { Button } from '@/components/Button'
// import { routes } from '@/components/Navigation/routes'
import { TwitterIcon } from '@/components/icons/TwitterIcon'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { DiscordIcon } from '@/components/icons/DiscordIcon'

// function PageLink({
//                     label,
//                     page,
//                     previous = false,
//                   }: {
//   label: string
//   page: { href: string; title: string }
//   previous?: boolean
// }) {
//   return (
//     <>
//       <Button
//         href={page.href}
//         aria-label={`${label}: ${page.title}`}
//         variant="secondary"
//         arrow={previous ? 'left' : 'right'}
//       >
//         {label}
//       </Button>
//       <Link
//         href={page.href}
//         tabIndex={-1}
//         aria-hidden="true"
//         className="text-base font-semibold text-zinc-900 transition hover:text-zinc-600 dark:text-white dark:hover:text-zinc-300"
//       >
//         {page.title}
//       </Link>
//     </>
//   )
// }

// function PageNavigation() {
//   let initialPathname = usePathname()
//   // Running on the server, there's bug with usePathname() and basePath https://github.com/vercel/next.js/issues/52700
//   if (typeof window === 'undefined' && initialPathname === '/') initialPathname = '/docs'

//   const allPages = routes.flatMap(group => group.links)
//   const currentPageIndex = allPages.findIndex(page => page.href === initialPathname)

//   if (currentPageIndex === -1) return null

//   const previousPage = allPages[currentPageIndex - 1]
//   const nextPage = allPages[currentPageIndex + 1]

//   if (!previousPage && !nextPage) return null

//   return (
//     <div className="flex">
//       {previousPage && (
//         <div className="flex flex-col items-start gap-3">
//           <PageLink
//             label="Previous"
//             page={previousPage}
//             previous
//           />
//         </div>
//       )}
//       {nextPage && (
//         <div className="ml-auto flex flex-col items-end gap-3">
//           <PageLink
//             label="Next"
//             page={nextPage}
//           />
//         </div>
//       )}
//     </div>
//   )
// }

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
    <Link href={href} className="group">
      <span className="sr-only">{children}</span>
      <Icon className="h-5 w-5 fill-zinc-700 transition group-hover:fill-zinc-900 dark:group-hover:fill-zinc-500" />
    </Link>
  )
}

function SmallPrint() {
  return (
    <div className="flex flex-col w-full items-center justify-between gap-5 pt-8 dark:border-white/5 sm:flex-row">
      <div className="flex flex-col items-center justify-start lg:items-start">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          &copy; FoundryLabs, Inc. {new Date().getFullYear()}. All rights
          reserved.
        </p>
      </div>
      <div className="flex gap-4">
        <SocialLink href="https://x.com/e2b" icon={TwitterIcon}>
          Follow us on X (f.k.a. Twitter)
        </SocialLink>
        <SocialLink href="https://github.com/e2b-dev" icon={GitHubIcon}>
          Follow us on GitHub
        </SocialLink>
        <SocialLink href="https://discord.gg/U7KEcGErtQ" icon={DiscordIcon}>
          Join our Discord server
        </SocialLink>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl space-y-10 pb-16 lg:max-w-5xl">
      {/* <PageNavigation /> */}
      <SmallPrint />
    </footer>
  )
}

export function FooterMain() {
  return (
    <footer className="flex w-full px-2 md:px-32 py-10">
      <div className="flex flex-col w-full items-center justify-center border-t border-zinc-900/5 dark:border-white/5">
        <SmallPrint />
      </div>
    </footer>
  )
}
