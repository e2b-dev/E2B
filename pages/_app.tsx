import type { AppProps } from 'next/app'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'
import { useEffect, useState } from 'react'
import { projects } from '@prisma/client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import Head from 'next/head'
import { useRouter } from 'next/router'

import 'styles/global.css'

import { Database } from 'db/supabase'
import { clientCreds } from 'db/credentials'
import Layout from 'components/Layout'

// Initialize PostHog
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // Use the ingest endpoint for all requests
    api_host: `${window.location.protocol}//${window.location.host}/ingest`,
    // Disable session recording when not in production
    disable_session_recording: process.env.NODE_ENV !== 'production',
    advanced_disable_toolbar_metrics: true,
    loaded: (posthog) => {
      // Enable debug mode in development
      if (process.env.NODE_ENV === 'development') {
        posthog.debug()
      }
    }
  })
}

function App({ Component, pageProps }: AppProps<{ initialSession?: Session, project?: projects }>) {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient<Database>(clientCreds))
  const router = useRouter()

  const isAgent = router.pathname.startsWith('/agent')

  const meta = {
    title: isAgent ? 'Smol Developer | e2b' : 'Dashboard | e2b',
    description: isAgent ? 'Smol Developer on e2b' : 'e2b Dashboard',
  }

  useEffect(function trackPageViews() {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    // Track page views
    const handleRouteChange = () => posthog?.capture('$pageview')
    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])


  return (
    <PostHogProvider
      client={process.env.NEXT_PUBLIC_POSTHOG_KEY ? posthog : undefined}
    >
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
      >
        <Head>
          <title>{meta.title}</title>
          <link rel="icon" href="/favicon.png" sizes="any" />
          <meta
            content="follow, index"
            name="robots"
          />
          <link
            href="/favicon.ico"
            rel="shortcut icon"
          />
          <meta
            content={meta.description}
            name="description"
          />
          <meta
            content="website"
            property="og:type"
          />
          <meta
            content={meta.title}
            property="og:site_name"
          />
          <meta
            content={meta.description}
            property="og:description"
          />
          <meta
            content={meta.title}
            property="og:title"
          />
          <meta
            content="summary_large_image"
            name="twitter:card"
          />
          <meta
            content="@devbookhq"
            name="twitter:site"
          />
          <meta
            content={meta.title}
            name="twitter:title"
          />
          <meta
            content={meta.description}
            name="twitter:description"
          />
        </Head>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </SessionContextProvider>
    </PostHogProvider>
  )
}

export default App
