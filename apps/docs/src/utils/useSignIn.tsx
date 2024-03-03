'use client'

import { useRouter } from 'next/navigation'

export interface Opts {
  view?: string;
  /**
   * Redirect to the current URL after signing in
   * @default Enabled by default
   */
  redirectToCurrentUrl?: boolean;
}

export function useSignIn() {
  const router = useRouter()

  return function signIn(opts?: Opts) {
    let target = '/sign-in'

    if (opts?.redirectToCurrentUrl !== false || opts?.view) {
      target += '?'
    }

    if (opts?.redirectToCurrentUrl !== false) {
      const url = typeof window !== 'undefined' ? window.location.href : undefined
      target += 'redirect_to=' + encodeURIComponent(url)
    }

    if (opts?.redirectToCurrentUrl !== false && opts?.view) {
      target += '&'
    }

    if (opts?.view) {
      target += 'view=' + encodeURIComponent(opts.view)
    }

    router.push(target, { scroll: true })
  }
}
