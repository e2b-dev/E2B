'use client'

import React, {useEffect, useState} from 'react'
import {usePathname, useSearchParams} from 'next/navigation'
import {usePostHog} from 'posthog-js/react'
import {useUser} from '@supabase/auth-helpers-react'
import * as gtag from '../utils/gtag'
import Script from 'next/script'

// Based on https://posthog.com/docs/libraries/next-js
function getFullUrl(pathname: string = '', searchParams: URLSearchParams | null) {
  let url = (typeof window !== 'undefined' ? window.origin : '')  + pathname
  if (searchParams?.toString()) {
    url = url + `?${searchParams.toString()}`
  }
  return url
}
// See https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#templates
// Templates are suitable for features that rely on useEffect (e.g logging page views) 
// See "Listening to page changes" https://nextjs.org/docs/app/api-reference/functions/use-router#router-events
export function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()
  const user = useUser()
  const [distinctID, setDistinctID] = useState<string>()
  
  // PostHog: Obtain distinct ID
  useEffect(function handleDistinctID() {
    try {
      setDistinctID(posthog?.get_distinct_id())
    } catch (err: any) {
      // See https://github.com/PostHog/posthog-js/issues/769
      if (!err.message.includes('reading \'props\'')) throw err
    }
  }, [posthog])

  // PostHog: Identify user
  useEffect(function identifyUser() {
    if (!user) return
    posthog?.identify(user.id, {
      email: user.email,
    })
  }, [posthog, user])

  // PostHog: Tracking
  useEffect(() => {
    posthog?.capture('$pageview')
  }, [posthog, pathname, searchParams])

  // Google Analytics: Tracking
  useEffect(() => {
    if (!pathname) return
    gtag.pageview(getFullUrl(pathname, searchParams), distinctID)
  }, [pathname, searchParams, user?.id, distinctID])
  
  return <>
    <Script id="google-analytics">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', '${gtag.GA_TRACKING_ID}', {
        page_path: window.location.pathname,
        ${distinctID ? `user_id: ${distinctID}` : ''}
      });
    `}</Script>
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_TRACKING_ID}`}
    />
    {children}
  </>
}

export default Template
