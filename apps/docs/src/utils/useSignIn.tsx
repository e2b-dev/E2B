'use client'

import { useRouter } from 'next/navigation'

export interface Opts {
  hash?: string;
  /**
   * Redirect to the current URL after signing in
   * @default Enabled by default
   */
  redirectToCurrentUrl?: boolean;
}

export function useSignIn() {
  const router = useRouter()

  return function signIn(opts?: Opts) {
    let target = '/sign'

    if (opts?.redirectToCurrentUrl !== false) {
      const url = typeof window !== 'undefined' ? window.location.href : undefined
      target += '?redirect_to=' + url
    }

    if (opts?.hash) {
      target += `#${opts.hash}`
    }

    router.push(target, { scroll: true })
  }
}
