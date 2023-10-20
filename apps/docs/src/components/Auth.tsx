import { Button } from '@/components/Button'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useAccessToken, useApiKey, useUser } from '@/utils/useUser'
import { LogOutIcon } from 'lucide-react'
import { CopyButton } from '@/components/CopyButton'
import clsx from 'clsx'
import { HeaderSeparator } from '@/components/HeaderUtils'
import { usePostHog } from 'posthog-js/react'
import { obfuscateSecret } from '@/utils/obfuscate'
import { useSignIn } from '@/utils/useSignIn'

import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover'

function CopyableSecret({
  secret = '',
  onAfterCopy,
  obfuscateStart,
  obfuscateEnd,
}: {
  secret: string
  onAfterCopy: () => void
  obfuscateStart?: number
  obfuscateEnd?: number
}) {
  return (
    <>
      <span className="whitespace-nowrap font-mono text-yellow-400 group-hover:opacity-25">
        {obfuscateSecret(secret, obfuscateStart, obfuscateEnd)}
      </span>
      <span className="absolute inset-0">
        <CopyButton
          code={secret}
          onAfterCopy={onAfterCopy}
          customPositionClassNames={clsx(
            'top-[-2px] bottom-[2px]' /* nudge 2px up*/,
            'left-[-6px] right-[-6px]' /* widen a little to fit nicely */,
            'min-h-[28px]',
          )}
        />
      </span>
    </>
  )
}

export const Auth = function () {
  const { user, isLoading, error } = useUser()
  const signIn = useSignIn()
  const apiKey = useApiKey()
  const accessToken = useAccessToken()
  const posthog = usePostHog()
  const router = useRouter()
  const supabase = createClientComponentClient()

  async function signOut() {
    await supabase.auth.signOut()
    posthog?.reset(true)
    router.push('/')
    window.location.reload()
  }

  if (error)
    return (
      <div className="flex flex-row items-center gap-4">
        <span
          className="text-sm text-red-500"
          title={error?.message}
        >
          Something went wrong
        </span>
        {/* @ts-ignore */}
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    )

  if (isLoading)
    return (
      <div className="flex animate-pulse">
        <div
          title="Loading..."
          className="h-2 w-40 rounded bg-slate-500"
        ></div>
      </div>
    )

  return (
    <>
      {user ? (
        <div className="flex flex-col items-center gap-4 min-[540px]:flex-row">
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
            <CopyableSecret
              secret={apiKey}
              onAfterCopy={() => posthog?.capture('copied API key')}
            />
          </div>
          <HeaderSeparator />
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger
                className="
                whitespace-nowrap text-xs font-bold
              "
              >
                {user.email}
              </PopoverTrigger>
              <PopoverContent className="w-144">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">API Key</span>
                    <span className="text-xs text-gray-200">
                      Use for <strong>running</strong> the sessions.
                    </span>
                    <div className="group relative text-xs">
                      <CopyableSecret
                        secret={apiKey}
                        onAfterCopy={() => posthog?.capture('copied API key')}
                        obfuscateStart={12}
                        obfuscateEnd={5}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      TIP: Set as <code>E2B_API_KEY</code> env var to avoid passing it
                      every time.
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Access Token</span>
                    <span className="text-xs text-gray-200">
                      Use for <strong>managing</strong> the sessions
                      (creating/listing/deleting).
                    </span>
                    <span className="text-xs text-gray-200">
                      Not needed when logging in via CLI via <code>e2b login</code>
                    </span>
                    <div className="group relative text-xs">
                      <CopyableSecret
                        secret={accessToken}
                        onAfterCopy={() => posthog?.capture('copied Access Token')}
                        obfuscateStart={12}
                        obfuscateEnd={5}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      TIP: Set as <code>E2B_ACCESS_TOKEN</code> env var to avoid passing
                      it every time.
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
          {/* @ts-ignore */}
          <Button
            onClick={() => signIn()}
            variant="textTernary"
            className="whitespace-nowrap text-xs"
          >
            Sign up to get your API key
          </Button>
          {/* @ts-ignore */}
          <Button onClick={() => signIn()}>Sign In</Button>
        </div>
      )}
    </>
  )
}
