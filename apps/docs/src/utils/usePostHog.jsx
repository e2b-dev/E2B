'use client'

import { PostHogProvider as OriginalPostHogProvider } from 'posthog-js/react'
import posthog from 'posthog-js'

export function maybeInit() {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${window.location.protocol}//${window.location.host}/ingest`,
    disable_session_recording: process.env.NODE_ENV !== 'production',
    advanced_disable_toolbar_metrics: true,
    loaded: (posthog) => {
      console.log('PostHog loaded', process.env.NODE_ENV)
      if (process.env.NODE_ENV === 'development') {
        posthog.debug()
      }
    }
  })
}

maybeInit()

// Based on https://posthog.com/tutorials/nextjs-app-directory-analytics
export function PostHogProvider({ children }) {
  return (
    <OriginalPostHogProvider client={process.env.NEXT_PUBLIC_POSTHOG_KEY ? posthog : undefined}>
      {children}
    </OriginalPostHogProvider>
  )
}
