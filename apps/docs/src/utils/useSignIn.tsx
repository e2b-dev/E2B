'use client'

import { useRouter } from 'next/navigation'

// TODO: Maybe consolidate with useUser?
export function useSignIn() {
  const router = useRouter()

  return function signIn(hash?: string) {
    router.push('/sign')
    if (hash) {
      router.push(`#${hash}`)
    }
  }
}
