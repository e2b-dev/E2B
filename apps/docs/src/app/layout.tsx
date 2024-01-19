import { Metadata } from 'next'
import glob from 'fast-glob'
import { Analytics } from '@vercel/analytics/react'

import { Providers } from '@/app/providers'
import { Layout } from '@/components/Layout'

import '@/styles/tailwind.css'
import { PostHogAnalytics } from '@/utils/usePostHog'
import { Section } from '@/components/SectionProvider'
import Canonical from '@/components/Navigation/canonical'

export const metadata: Metadata = {
  title: {
    template: '%s - E2B Docs',
    default: 'E2B Docs - Runtime Sandbox for LLM Apps',
  },
  description: 'Sandboxed cloud environments for AI-powered apps and agentic workflows',
  twitter: {
    title: 'E2B Docs - Runtime Sandbox for LLM Apps',
    description: 'Sandboxed cloud environments for AI-powered apps and agentic workflows',
  },
  openGraph: {
    title: 'E2B Docs - Runtime Sandbox for LLM Apps',
    description: 'Sandboxed cloud environments for AI-powered apps and agentic workflows',
  },
}

export default async function RootLayout({ children }) {
  const pages = await glob('**/*.mdx', { cwd: 'src/app' })
  const allSectionsEntries = (await Promise.all(
    pages.map(async filename => [
      '/' + filename.replace(/(^|\/)page\.mdx$/, ''),
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
      </body>
    </html>
  )
}
