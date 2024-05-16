import { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'

import { Providers } from '@/app/(docs)/docs/providers'

import '@/styles/tailwind.css'
import { PostHogAnalytics } from '@/utils/usePostHog'
import Canonical from '@/components/Navigation/canonical'
import { LayoutMain } from '@/components/LayoutMain'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  // TODO: Add metadataBase
  // metadataBase: ''
  title: {
    template: '%s - E2B',
    default: 'E2B - Code Interpreting for AI apps',
  },
  description: 'Open-source secure sandboxes for AI code execution',
  twitter: {
    title: 'E2B - Code Interpreting for AI apps',
    description: 'Open-source secure sandboxes for AI code execution',
  },
  openGraph: {
    title: 'E2B - Code Interpreting for AI apps',
    description: 'Open-source secure sandboxes for AI code execution',
  },
}

export default async function RootLayout({ children }) {


  return (
    <html
      lang="en"
      className="h-full"
      suppressHydrationWarning
    >
      <head>
        <Canonical />
      </head>
      <body className="flex min-h-full bg-white antialiased dark:bg-zinc-900">
        <Providers>
          <div className="w-full">
            <LayoutMain>
              {children}
              <Toaster />
              <PostHogAnalytics />
              <Analytics />
            </LayoutMain>
          </div>
        </Providers>
      </body>
    </html>
  )
}
