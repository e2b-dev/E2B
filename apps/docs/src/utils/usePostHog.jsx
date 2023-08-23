'use client'

import { PostHogProvider as OriginalPostHogProvider } from 'posthog-js/react'
import posthog from 'posthog-js'
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function maybeInit() {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // Note that PostHog will automatically capture page views and common events
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

export function PostHogAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams.toString()) url = url + `?${searchParams.toString()}`
      posthog.capture(
        '$pageview',
        { '$current_url': url }
      )
    }
  }, [pathname, searchParams])
  
}
