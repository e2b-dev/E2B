'use client'

import Link from 'next/link'
import { LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/Button'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useUser } from '@/utils/useUser'
import { usePostHog } from 'posthog-js/react'

export const Auth = function () {
  const { user, isLoading, error } = useUser()
  const posthog = usePostHog()
  const router = useRouter()
  const supabase = createClientComponentClient()

  async function signOut() {
    await supabase.auth.signOut()
    posthog?.reset(true)
    router.push('/')
    window.location.reload()
  }

  function redirectToCurrentURL() {
    const url = typeof window !== 'undefined' ? window.location.href : undefined

    if (!url) {
      return ''
    }

    const encodedURL = encodeURIComponent(url)
    return `redirect_to=${encodedURL}`
  }


  if (error)
    return (
      <div className="flex flex-row items-center gap-4">
        <span className="text-sm text-red-500" title={error?.message}>
          Something went wrong
        </span>
        <Link href={`/sign-in?${redirectToCurrentURL()}`}>
          <Button>Sign In</Button>
        </Link>
      </div>
    )

  if (isLoading)
    return (
      <div className="flex animate-pulse">
        <div title="Loading..." className="h-2 w-40 rounded bg-slate-500"></div>
      </div>
    )

  return (
    <>
      {user ? (
        <div className="flex flex-col items-center gap-4 min-[540px]:flex-row">
          <div className="flex items-center gap-2">
            <div className="whitespace-nowrap text-xs font-bold">
              {user.email}
            </div>
            {/* @ts-ignore */}
            <Button
              variant="textSubtle"
              title="Sign out"
              onClick={() => signOut()}
            >
              <LogOutIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <Link href={`/sign-in?view=sign-up&${redirectToCurrentURL()}`}>
            <Button
              variant="textTernary"
              className="whitespace-nowrap text-xs"
            >
              Sign up to get your API key
            </Button>
          </Link>

          <Link href={`/sign-in?${redirectToCurrentURL()}`}>
            <Button>Sign In</Button>
          </Link>
        </div>
      )}
    </>
  )
}
