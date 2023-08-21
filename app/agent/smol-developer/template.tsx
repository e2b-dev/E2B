import clsx from 'clsx'
import { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ReactNode } from 'react'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

interface Props {
  children: ReactNode
}

export const metadata: Metadata = {
  title: 'Smol Developer | e2b',
  description: 'Smol Developer on e2b',
  robots: 'follow, index'
}

export default function Template(props: Props) {
  const { children } = props
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