import Script from 'next/script'
import { Metadata } from 'next'
import glob from 'fast-glob'
import { Analytics } from '@vercel/analytics/react'

import { Providers } from '@/app/(docs)/docs/providers'
import { Layout } from '@/components/Layout'

import '@/styles/tailwind.css'
import { PostHogAnalytics } from '@/utils/usePostHog'
import { Section } from '@/components/SectionProvider'
import Canonical from '@/components/Navigation/canonical'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'chatlio-widget': any;
    }
  }
}

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
  const pages = await glob('**/*.mdx', { cwd: 'src/app/(docs)/docs' })
  const allSectionsEntries = (await Promise.all(
    pages.map(async filename => [
      '/docs/' + filename.replace(/\(docs\)\/?|(^|\/)page\.mdx$/, ''),
      (await import(`./${filename}`)).sections,
    ]),
  )) as Array<[string, Array<Section>]>
  const allSections = Object.fromEntries(allSectionsEntries)
    
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
            <Layout allSections={allSections}>
              {children}
              <PostHogAnalytics />
              <Analytics />
            </Layout>
          </div>
        </Providers>

        <Script src="https://js.chatlio.com/widget.js" strategy="lazyOnload" />
        <chatlio-widget widgetid={process.env.NEXT_PUBLIC_CHATLIO_WIDGET_ID} disable-favicon-badge></chatlio-widget>
      </body>
    </html>
  )
}
