import { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import Script from 'next/script'
import { Providers } from '@/app/providers'
import '@/styles/tailwind.css'
import { Header } from '@/components/Header'
import glob from 'fast-glob'
import { Section } from '@/components/SectionProvider'
import { Layout } from '@/components/Layout'
import { headers } from 'next/headers'

async function isValidPath(pathname: string) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://e2b.dev'
    const sitemapUrl = `${baseUrl}/sitemap.xml`

    // NOTE: Expects all valid paths to be in one sitemap.xml file
    const response = await fetch(sitemapUrl, {
      cache: 'force-cache',
    })

    if (!response.ok) {
      console.error('Sitemap fetch failed:', response.statusText)
      return false
    }

    const sitemapXml = await response.text()
    const targetUrl = `https://e2b.dev${pathname}`
    const isValid = sitemapXml.includes(`<loc>${targetUrl}</loc>`)

    return isValid
  } catch (error) {
    console.error('Error validating path in isValidPath:', error)
    return false
  }
}

export async function generateMetadata() {
  const headerList = headers()
  const pathname = headerList.get('x-middleware-pathname')
  const shouldIndex = headerList.get('x-e2b-should-index')

  let isValid = false

  if (pathname?.startsWith('/docs')) {
    isValid = await isValidPath(pathname)
  }

  return {
    title: {
      template: '%s - E2B',
      default: 'SDK Reference - E2B',
    },
    description:
      'SDK Reference Documentation for E2B JavaScript and Python SDKs. API Methods, Classes, and Examples for Integrating Secure Cloud Sandboxes.',
    twitter: {
      title: 'SDK Reference - E2B',
      description:
        'SDK Reference Documentation for E2B JavaScript and Python SDKs. API Methods, Classes, and Examples for Integrating Secure Cloud Sandboxes.',
    },
    openGraph: {
      title: 'SDK Reference - E2B',
      description:
        'SDK Reference Documentation for E2B JavaScript and Python SDKs. API Methods, Classes, and Examples for Integrating Secure Cloud Sandboxes.',
    },
    alternates:
      isValid && pathname !== ''
        ? {
            canonical: `https://e2b.dev${pathname}`,
          }
        : undefined,
    robots:
      isValid && shouldIndex
        ? { index: true, follow: true }
        : { index: false, follow: false },
  } satisfies Metadata
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'chatlio-widget': any
    }
  }
}

export default async function RootLayout({ children }) {
  const pages = await glob('**/*.mdx', { cwd: 'src/app/(docs)/docs' })
  const allSectionsEntries = (await Promise.all(
    pages.map(async (filename) => [
      '/docs/' + filename.replace(/\(docs\)\/?|(^|\/)page\.mdx$/, ''),
      (await import(`./(docs)/docs/${filename}`)).sections,
    ])
  )) as Array<[string, Array<Section>]>
  const allSections = Object.fromEntries(allSectionsEntries)

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === 'production' && (
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-K2W3LVD2');
            `}
          </Script>
        )}
      </head>
      <body className="flex min-h-full antialiased bg-zinc-900">
        {process.env.NODE_ENV === 'production' && (
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-K2W3LVD2"
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <Providers>
          <Layout allSections={allSections}>
            <Header />
            {children}
          </Layout>
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
