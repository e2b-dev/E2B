import clsx from 'clsx'
import { Inter } from 'next/font/google'
import { ReactNode } from 'react'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

// This layout is slightly overkill, but it matches the original Layout used in /pages, let's consider simplifying after full migration
// FIXME: Implement tracking from components/Layout or re-use it instead of this one
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className={clsx(
        inter.variable,
        'font-sans',
        'flex',
        'h-full',
        'w-full',
        'flex-1',
        'flex-col',
        'overflow-hidden'
      )}
    >
      {children}
    </div>
  )
}
