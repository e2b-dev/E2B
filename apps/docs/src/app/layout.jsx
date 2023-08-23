import glob from 'fast-glob'
import { Analytics } from '@vercel/analytics/react';

import { Providers } from '@/app/providers'
import { Layout } from '@/components/Layout'


import '@/styles/tailwind.css'
import { PostHogAnalytics } from '@/utils/usePostHog';

export const metadata = {
  title: {
    template: '%s - E2B Documentation',
    default: 'E2B Documentation',
  },
}

export default async function RootLayout({ children }) {
  let pages = await glob('**/*.mdx', { cwd: 'src/app' })
  let allSections = await Promise.all(
    pages.map(async (filename) => [
      '/' + filename.replace(/(^|\/)page\.mdx$/, ''),
      (await import(`./${filename}`)).sections,
    ])
  )
  allSections = Object.fromEntries(allSections)

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
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
