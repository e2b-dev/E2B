'use client'

import clsx from 'clsx'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

import { Footer } from '@/components/Footer'
import { DocsNavigation, SdkRefNavigation } from '@/components/Navigation'
import { Section, SectionProvider } from '@/components/SectionProvider'
import { Search } from './Search'

export function Layout({
  children,
  allSections,
}: {
  children: React.ReactNode
  allSections: Record<string, Array<Section>>
}) {
  const pathname = usePathname()
  const relativePathname = pathname?.replace(new RegExp('^/docs'), '')
  const isDocs = pathname?.startsWith('/docs')
  const isApiRef = pathname?.startsWith('/docs/sdk-reference')

  return (
    <SectionProvider
      sections={relativePathname ? (allSections[relativePathname] ?? []) : []}
    >
      <div
        className={clsx('h-[100vh] w-full', {
          'lg:ml-[var(--sidebar-nav-width)]': isDocs,
        })}
      >
        <motion.header
          layoutScroll
          className="contents lg:pointer-events-none lg:fixed lg:inset-0 lg:z-40 lg:flex lg:top-[60px]"
        >
          {isDocs && (
            <div
              id="sidebar"
              className="
                lg:pointer-events-auto
                scrollbar-thin
                scrollbar-thumb-scrollbar
                contents
                lg:block
                lg:w-[var(--sidebar-nav-width)]
                lg:overflow-y-auto
                lg:px-4
                border-r
                border-white/10
                lg:pb-4
              "
            >
              <div className="hidden space-y-4 lg:block lg:mt-4">
                <Search />
                {isApiRef ? <SdkRefNavigation /> : <DocsNavigation />}
              </div>
            </div>
          )}
        </motion.header>
        {isDocs && (
          <div
            className="
          relative
          h-full
          flex
          flex-col
          px-4
          pt-14
          sm:px-6
          lg:ml-1
          lg:px-8
          lg:dark:border-white/10
          "
          >
            <main
              className="
              flex-auto
            "
            >
              {children}
            </main>
            <Footer />
          </div>
        )}
        {!isDocs && (
          <div
            className="
          relative
          flex
          h-full
          flex-col
          pt-14
          "
          >
            <main
              className="
            flex-auto
          "
            >
              {children}
            </main>
          </div>
        )}
      </div>
    </SectionProvider>
  )
}
