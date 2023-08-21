import { useUser } from '@supabase/auth-helpers-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import * as gtag from '../../utils/gtag'


export function useAnalyticsProvider() {
  const user = useUser()
  const posthog = usePostHog()
  const router = useRouter()
  const [distinctID, setDistinctID] = useState<string>()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Listen to URL changes and push to GTAG
  useEffect(() => {
    gtag.pageview(`${pathname}?${searchParams}`, distinctID)
  }, [pathname, searchParams])

  useEffect(function handleDistinctID() {
    if (posthog) {
      setDistinctID(posthog.get_distinct_id())
    }
  }, [posthog])

  useEffect(function identifyUser() {
    if (user) {
      posthog?.identify(user.id, {
        email: user.email,
      })
    }
  }, [posthog, user])

  return { distinctID }
}