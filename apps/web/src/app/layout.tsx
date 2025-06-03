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
  const startTime = Date.now()
  console.log('🔍 [isValidPath] Starting validation for:', pathname)
  console.log('🌍 [isValidPath] Environment:', {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    LAMBDA_RUNTIME_DIR: process.env.LAMBDA_RUNTIME_DIR,
    cwd: process.cwd(),
  })

  try {
    let rootAppDirPath: string
    let pathStrategy: string

    if (
      process.env.VERCEL_ENV === 'production' &&
      process.env.LAMBDA_RUNTIME_DIR
    ) {
      // Use LAMBDA_RUNTIME_DIR in Vercel production for reliable path resolution
      rootAppDirPath = path.join(process.env.LAMBDA_RUNTIME_DIR, 'src', 'app')
      pathStrategy = 'LAMBDA_RUNTIME_DIR'
      console.log('📁 [isValidPath] Using LAMBDA_RUNTIME_DIR strategy')
    } else if (process.env.VERCEL_ENV === 'production') {
      // Fallback for production without LAMBDA_RUNTIME_DIR
      const cwd = process.cwd()
      const isMonorepo = cwd.includes('apps/web') || cwd.endsWith('apps/web')
      rootAppDirPath = isMonorepo
        ? path.join(cwd, 'src', 'app')
        : path.join(cwd, 'apps', 'web', 'src', 'app')
      pathStrategy = `FALLBACK_PRODUCTION (monorepo: ${isMonorepo})`
      console.log(
        '📁 [isValidPath] Using fallback production strategy, monorepo detected:',
        isMonorepo
      )
    } else {
      // Development environment
      rootAppDirPath = path.join(process.cwd(), 'src', 'app')
      pathStrategy = 'DEVELOPMENT'
      console.log('📁 [isValidPath] Using development strategy')
    }

    console.log('📂 [isValidPath] Path construction:', {
      strategy: pathStrategy,
      rootAppDirPath,
      targetPath: `${rootAppDirPath}/(docs)${pathname}`,
    })

    const globPattern = '**/*.mdx'
    const globCwd = `${rootAppDirPath}/(docs)${pathname}`

    console.log('🔎 [isValidPath] Starting glob search:', {
      pattern: globPattern,
      cwd: globCwd,
    })

    const docsDirectory = await glob(globPattern, {
      cwd: globCwd,
    })

    console.log('📄 [isValidPath] Glob results:', {
      filesFound: docsDirectory.length,
      files: docsDirectory,
      hasPageMdx: docsDirectory.includes('page.mdx'),
    })

    const isValid =
      docsDirectory.length > 0 && docsDirectory.includes('page.mdx')
    const duration = Date.now() - startTime

    console.log('✅ [isValidPath] Validation complete:', {
      pathname,
      isValid,
      duration: `${duration}ms`,
      strategy: pathStrategy,
    })

    return isValid
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ [isValidPath] Error during validation:', {
      pathname,
      duration: `${duration}ms`,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    })
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
