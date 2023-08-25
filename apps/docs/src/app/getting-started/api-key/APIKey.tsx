'use client'

import clsx from 'clsx'
import { Button } from '@/components/Button'
import { useApiKey, useUser } from '@/utils/useUser'
import { obfuscateKey } from '@/utils/obfuscate'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { CopyButton } from '@/components/CopyButton'
import { usePostHog } from 'posthog-js/react'

function APIKey() {
  const supabase = createClientComponentClient()
  const { user, isLoading, error } = useUser()
  const apiKey = useApiKey()
  const posthog = usePostHog()

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
        <div
          className="
            group relative flex
            flex-row
            gap-2 text-xs
          "
        >
          <span className="whitespace-nowrap text-zinc-400 group-hover:opacity-25 font-bold">
            API Key
          </span>
          <span className="whitespace-nowrap font-mono text-yellow-400 group-hover:opacity-25">
            {obfuscateKey(apiKey)}
          </span>
          <span className="absolute inset-0">
            <CopyButton
              code={apiKey}
              onAfterCopy={() => posthog?.capture('copied API key')}
              customPositionClassNames={clsx(
                'top-[-2px] bottom-[2px]' /* nudge 2px up*/,
                'left-[-6px] right-[-6px]' /* widen a little to fit nicely */,
                'min-h-[28px]'
              )}
            />
          </span>
        </div>
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