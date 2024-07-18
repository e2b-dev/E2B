import Script from 'next/script'
import { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'

import { Providers } from '@/app/providers'

import '@/styles/tailwind.css'
import { PostHogAnalytics } from '@/utils/usePostHog'
import Canonical from '@/components/Navigation/canonical'
import { Suspense } from 'react'
import { Header } from '@/components/Header'

export const metadata: Metadata = {
  // TODO: Add metadataBase
  // metadataBase: ''
  title: {
    template: '%s - E2B Docs',
    default: 'E2B Docs - Code Interpreting for AI apps',
  },
  description: 'Open-source secure sandboxes for AI code execution',
  twitter: {
    title: 'E2B Docs - Code Interpreting for AI apps',
    description: 'Open-source secure sandboxes for AI code execution',
  },
  openGraph: {
    title: 'E2B Docs - Code Interpreting for AI apps',
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
            <Header />
            {children}
          </div>
          <Suspense>
            <PostHogAnalytics />
          </Suspense>
          <Analytics />
        </Providers>

        <Script src="https://js.chatlio.com/widget.js" strategy="lazyOnload" />
        <chatlio-widget widgetid={process.env.NEXT_PUBLIC_CHATLIO_WIDGET_ID} disable-favicon-badge></chatlio-widget>
      </body>
    </html>
  )
}
