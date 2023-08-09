'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { PostHogProvider as OriginalPostHogProvider } from 'posthog-js/react'
import posthog from 'posthog-js'
import * as posthogBrowser from '../../utils/posthogBrowser'

posthogBrowser.maybeInit()

// Based on https://posthog.com/tutorials/nextjs-app-directory-analytics
export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Listening to page changes, see https://nextjs.org/docs/app/api-reference/functions/use-router#router-events
  useEffect(() => {
    posthog?.capture('$pageview')
  }, [pathname, searchParams])

  return (
    <OriginalPostHogProvider client={posthog}>
      {children}
    </OriginalPostHogProvider>
  )
}
