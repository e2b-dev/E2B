'use client'

import { ReactNode } from 'react'
import { PostHogProvider as OriginalPostHogProvider } from 'posthog-js/react'
import posthog from 'posthog-js'
import * as posthogBrowser from '../../utils/posthogBrowser'

posthogBrowser.maybeInit()

// Based on https://posthog.com/tutorials/nextjs-app-directory-analytics
export function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <OriginalPostHogProvider client={process.env.NEXT_PUBLIC_POSTHOG_KEY ? posthog : undefined}>
      {children}
    </OriginalPostHogProvider>
  )
}
