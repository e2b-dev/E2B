'use client'

import { Button } from '@/components/Button'
import { useApiKey, useUser } from '@/utils/useUser'
import { obfuscateKey } from '@/utils/obfuscate'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

function APIKey() {
  const supabase = createClientComponentClient()
  const { user, isLoading, error } = useUser()
  const apiKey = useApiKey()

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      // redirect to GitHub
      provider: 'github',
      options: {
        redirectTo: window.location.href,
        scopes: 'email',
      },
    })
  }

  return (
    <div className="flex flex-col items-start justify-start space-y-4">
      {user ? (
        <>
          <span className="whitespace-nowrap text-zinc-400 group-hover:opacity-25">
            API key
          </span>
        </>
      ) : (
        <>
          <span>You can get your API key by signing up.</span>
          <Button onClick={signInWithGitHub}>
            Sign up to get your API key
          </Button>
        </>
      )}
    </div>
  )
}

export default APIKey