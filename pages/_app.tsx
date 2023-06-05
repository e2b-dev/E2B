import type { AppProps } from 'next/app'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'
import { useEffect, useState } from 'react'
import { projects } from '@prisma/client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

import 'styles/global.css'

import { Database } from 'db/supabase'
import { clientCreds } from 'db/credentials'
import { useRouter } from 'next/router'
import Layout from 'components/Layout'

// Initialize PostHog
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${window.location.protocol}//${window.location.host}/ingest`,
    // Enable debug mode in development
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') posthog.debug()
    }
  })
}

function App({ Component, pageProps }: AppProps<{ initialSession?: Session, project?: projects }>) {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient<Database>(clientCreds))
  const router = useRouter()

  useEffect(function trackPageViews() {
    // Track page views
    const handleRouteChange = () => posthog?.capture('$pageview')
    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])

  return (
    <PostHogProvider
      client={posthog}
    >
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
      >
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </SessionContextProvider>
    </PostHogProvider>
  )
}

export default App
