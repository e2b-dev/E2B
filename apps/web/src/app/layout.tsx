import { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'

import { Providers } from '@/app/providers'

import '@/styles/tailwind.css'
import { PostHogAnalytics } from '@/utils/usePostHog'
import Canonical from '@/components/Navigation/canonical'
import { Suspense } from 'react'
import { Header } from '@/components/Header'
import glob from 'fast-glob'
import { Section } from '@/components/SectionProvider'
import { Layout } from '@/components/Layout'

export const metadata: Metadata = {
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'chatlio-widget': any;
    }
  }
}


export default async function RootLayout({ children }) {
  const pages = await glob('**/*.mdx', { cwd: 'src/app/(docs)/docs' })
  const allSectionsEntries = (await Promise.all(
    pages.map(async filename => [
      '/docs/' + filename.replace(/\(docs\)\/?|(^|\/)page\.mdx$/, ''),
      (await import(`./(docs)/docs/${filename}`)).sections,
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
      <body className="flex min-h-full antialiased bg-zinc-900">
        <Providers>
          <Layout allSections={allSections}>
            <Header />
            {children}
          </Layout>
          <Suspense>
            <PostHogAnalytics />
          </Suspense>
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
