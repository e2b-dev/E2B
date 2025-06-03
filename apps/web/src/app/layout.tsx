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
import path from 'path'

async function isValidPath(pathname: string) {
  try {
    const rootAppDirPath = path.join(
      process.env.NODE_ENV === 'production'
        ? path.join('.', 'src', 'app')
        : path.join(process.cwd(), 'src', 'app')
    )

    console.log('LAYOUT METADATA ROOT APP DIR PATH', rootAppDirPath)

    const docsDirectory = await glob('**/*.mdx', {
      cwd: `${rootAppDirPath}/(docs)${pathname}`,
    })

    console.log('LAYOUT METADATA DOCS DIRECTORY', docsDirectory)

    return docsDirectory.length > 0 && docsDirectory.includes('page.mdx')
  } catch (error) {
    console.error('Error validating path in generateMetadata:', error)
    return false
  }
}

export async function generateMetadata() {
  const headerList = headers()
  const pathname = headerList.get('x-middleware-pathname')
  const shouldIndex = headerList.get('x-e2b-should-index')

  console.log('LAYOUT METADATA HEADERS', Array.from(headerList.entries()))
  console.log('LAYOUT METADATA PATHNAME', pathname)
  console.log('LAYOUT METADATA SHOULD INDEX', shouldIndex)

  let isValid = false

  if (pathname?.startsWith('/docs')) {
    isValid = await isValidPath(pathname)
  }

  return {
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
