'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// TODO: Maybe consolidate with useUser?
export function useSignIn() {
  const supabase = createClientComponentClient()
  return async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.href,
        scopes: 'email',
      },
    })
  }
}
