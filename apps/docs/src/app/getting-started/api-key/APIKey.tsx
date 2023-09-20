'use client'

import clsx from 'clsx'
import { Button } from '@/components/Button'
import { useApiKey, useUser } from '@/utils/useUser'
import { obfuscateSecret } from '@/utils/obfuscate'
import { CopyButton } from '@/components/CopyButton'
import { usePostHog } from 'posthog-js/react'
import { useSignIn } from '@/utils/useSignIn'

function APIKey() {
  const signIn = useSignIn()
  const { user } = useUser()
  const apiKey = useApiKey()
  const posthog = usePostHog()

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
          <span className="whitespace-nowrap font-bold text-zinc-400 group-hover:opacity-25">
            API Key
          </span>
          <span className="whitespace-nowrap font-mono text-yellow-400 group-hover:opacity-25">
            {obfuscateSecret(apiKey)}
          </span>
          <span className="absolute inset-0">
            <CopyButton
              code={apiKey}
              onAfterCopy={() => posthog?.capture('copied API key')}
              customPositionClassNames={clsx(
                'top-[-2px] bottom-[2px]' /* nudge 2px up*/,
                'left-[-6px] right-[-6px]' /* widen a little to fit nicely */,
                'min-h-[28px]',
              )}
            />
          </span>
        </div>
      ) : (
        <>
          <span>You can get your API key by signing up.</span>
          <Button onClick={() => signIn()}>Sign up to get your API key</Button>
        </>
      )}
    </div>
  )
}

export default APIKey
