import { Button } from '@/components/Button';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation';
import { useApiKey, useUser } from '@/utils/useUser';
import { LogOutIcon } from 'lucide-react'
import { CopyButton } from '@/components/CopyButton';
import clsx from 'clsx';
import { HeaderSeparator } from '@/components/HeaderUtils';
import { usePostHog } from 'posthog-js/react'

export const Auth = function () {
  const { user, isLoading, error } = useUser()
  const apiKey = useApiKey()
  const posthog = usePostHog()
  const router = useRouter()
  const supabase = createClientComponentClient()

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({ // redirect to GitHub
      provider: 'github',
      options: {
        redirectTo: window.location.href,
        scopes: 'email',
      }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    posthog?.reset(true)
    router.push('/')
    window.location.reload()
  }

  if (error) return <div className="flex flex-row items-center gap-4">
    <span className="text-red-500 text-sm" title={error?.message}>
      Something went wrong
    </span>
    {/* @ts-ignore */}
    <Button onClick={() => signInWithGitHub()}>Login</Button>
  </div>

  if (isLoading) return <div className="animate-pulse flex">
    <div
      title="Loading..."
      className="w-40 h-2 bg-slate-500 rounded"
    ></div>
  </div>

  return (<>
      {user ? (
        <div className="flex flex-col min-[540px]:flex-row items-center gap-4">
          <div
            className="
              flex flex-row gap-2
              text-xs
              group relative
            "
          >
            <span className="group-hover:opacity-25 text-zinc-400 whitespace-nowrap">API key</span>
            <span className="group-hover:opacity-25 text-yellow-400 whitespace-nowrap font-mono">{obfuscateKey(apiKey)}</span>
            <span className="absolute inset-0">
              <CopyButton
                code={apiKey}
                onAfterCopy={() =>
                  posthog?.capture('copied API key')
                }
                customPositionClassNames={clsx(
                  "top-[-2px] bottom-[2px]", /* nudge 2px up*/
                  "left-[-6px] right-[-6px]", /* widen a little to fit nicely */
                  "min-h-[28px]"
                )}
              />
            </span>
          </div>
          <HeaderSeparator />
          <div className="flex items-center gap-2">
            <div className="
              text-xs font-bold whitespace-nowrap
            ">
              {user.email}
              {/* TODO: Add dropdown with more options: Dashboard, API keys, ... */}
            </div>
            {/* @ts-ignore */}
            <Button
              variant="textSubtle"
              title="Sign out"
              onClick={() => signOut()}
            >
              <LogOutIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* @ts-ignore */}
          <Button onClick={() => signInWithGitHub()} variant="textTernary" className="text-xs">Login to get your API key</Button>
          {/* @ts-ignore */}
          <Button onClick={() => signInWithGitHub()}>Login</Button>
        </div>
      )}
    </>
  )
}

/**
 * Obfuscate the API key by replacing the middle part with asterisks
 * @param {string} apiKey
 * @returns {string}
 */
function obfuscateKey(apiKey) {
  return apiKey.substring(0, 7) + '*'.repeat(4) + apiKey.substring(apiKey.length - 3)
}
