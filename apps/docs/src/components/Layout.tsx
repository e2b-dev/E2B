'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Navigation } from '@/components/Navigation'
import { Section, SectionProvider } from '@/components/SectionProvider'

export function Layout({
  children,
  allSections,
}: {
  children: React.ReactNode
  allSections: Record<string, Array<Section>>
}) {
  const pathname = usePathname()
  const relativePathname = pathname.replace(new RegExp('^/docs'), '')

  return (
    <SectionProvider sections={allSections[relativePathname] ?? []}>
      <div className="h-full lg:ml-[var(--sidebar-nav-width)]">
        <motion.header
          layoutScroll
          className="contents lg:pointer-events-none lg:fixed lg:inset-0 lg:top-[60px] lg:z-40 lg:flex"
        >
          <div
            id="sidebar"
            className="
              scrollbar-thin
              scrollbar-thumb-scrollbar
              contents
              lg:pointer-events-auto
              lg:block
              lg:w-[var(--sidebar-nav-width)]
              lg:overflow-y-auto
              lg:px-6
              lg:pb-8
            "
          >
            <Header />
            <Navigation className="hidden lg:my-4 lg:block" />
          </div>
        </motion.header>
        <div
          className="
          relative
          flex
          h-full
          flex-col
          px-4
          pt-14
          sm:px-6
          lg:ml-1
          lg:border-l
          lg:border-zinc-900/10
          lg:px-8
          lg:dark:border-white/10
          "
        >
          <main className="
            flex-auto
          ">{children}</main>
          <Footer />
        </div>
      </div>
    </SectionProvider>
  )
}
