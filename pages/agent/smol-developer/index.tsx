import {
  Github,
} from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { InferGetServerSidePropsType, GetServerSideProps } from 'next'
import Image from 'next/image'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import {
  useUser,
  useSessionContext,
} from '@supabase/auth-helpers-react'
import { usePostHog } from 'posthog-js/react'


import { serverCreds } from 'db/credentials'
import SpinnerIcon from 'components/Spinner'

type Repo = {
  name: string
  stargazers_count: number
}

export const getServerSideProps: GetServerSideProps<{
  repo: Repo,
}> = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx, serverCreds)

  const [{ data: { session } }, ghResponse] = await Promise.all([
    supabase.auth.getSession(),
    fetch('https://api.github.com/repos/smol-ai/developer'),
  ])

  if (session) {
    return {
      redirect: {
        destination: '/agent/smol-developer/setup',
        permanent: false,
      },
    }
  }
  const repo = await ghResponse.json()
  return { props: { repo } }
}

function SmolDeveloper({
  repo,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const sessionCtx = useSessionContext()
  const router = useRouter()
  const posthog = usePostHog()

  useEffect(() => {
    if (user) {
      router.reload()
    }
  }, [user, router])

  async function signInWithGitHub() {
    await supabaseClient.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.href,
        scopes: 'email',
      }
    })
  }

  return (
    <div className="bg-white h-full">
      <div className="m-auto h-full max-w-full">
        <div className="h-full relative isolate overflow-auto md:overflow-hidden bg-gray-900 px-6 pt-16 shadow-2xl sm:px-16 md:pt-24 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0">
          <svg
            viewBox="0 0 1024 1024"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
            aria-hidden="true"
          >
            <circle cx={512} cy={512} r={512} fill="url(#759c1415-0410-454c-8f7c-9a820de03641)" fillOpacity="0.7" />
            <defs>
              <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
                <stop stopColor="#7775D6" />
                <stop offset={1} stopColor="#E935C1" />
              </radialGradient>
            </defs>
          </svg>
          <div className="m-auto max-w-xl text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left">
            <div className="flex flex-col space-y-4 items-center lg:items-start">
              <a
                href="/" className="inline-flex space-x-6"
                onMouseDown={() => posthog?.capture('Clicked link to e2b homepage')}
              >
                <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-semibold leading-6 text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                  Runs on <b>e2b</b>
                </span>
              </a>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your personal AI developer.
                <br />
                With a single click.
              </h2>
            </div>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Get your own AI developer that&apos;s powered by the
              {' '}<a
                className="text-indigo-500 cursor-pointer font-bold"
                href="https://github.com/smol-ai/developer"
                rel="noreferer noopener"
                target="_blank"
                onMouseDown={() => posthog?.capture('Clicked link', { url: 'https://github.com/smol-ai/developer' })}
              >smol developer
              </a>{' '}
              AI agent.
              You specify the instructions and then let smol developer do its work for you.
            </p>
            <div className="mt-6 flex flex-col space-y-4">
              <div className="flex flex-col space-y-2">
                <span className="text-gray-400">Powered by smol ai&apos;s agent</span>
                <a
                  className="cursor-pointer flex justify-between py-2 px-4 w-full rounded-md bg-white/5 ring-1 ring-white/10 text-white font-semibold"
                  href="https://github.com/smol-ai/developer"
                  rel="noreferer noopener"
                  target="_blank"
                  onMouseDown={() => posthog?.capture('Clicked link', { url: 'https://github.com/smol-ai/developer' })}
                >
                  <span>smol-ai/developer</span>
                  <span>Stars {repo.stargazers_count.toLocaleString()}</span>
                </a>
              </div>
              <div className="flex items-center justify-between gap-x-6">
                {sessionCtx.isLoading && (
                  <div
                    className="
                      flex
                      justify-center
                    "
                  >
                    <SpinnerIcon className="text-slate-400" />
                  </div>
                )}
                {/* Also show the spinner when session is loaded and the user is also loaded because we're just waiting for the redirect to /setup */}
                {!sessionCtx.isLoading && user && (
                  <div
                    className="
                      flex
                      justify-center
                    "
                  >
                    <SpinnerIcon className="text-slate-400" />
                  </div>
                )}
                {!sessionCtx.isLoading && !user &&
                  <button
                    className="flex items-center space-x-2 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    onClick={signInWithGitHub}
                  >
                    <Github size={16} />
                    <span>Continue with GitHub</span>
                  </button>
                }
                <a
                  className="text-sm font-semibold leading-6 text-white"
                  href="https://github.com/smol-ai/developer"
                  rel="noreferer noopener"
                  target="_blank"
                  onMouseDown={() => posthog?.capture('Clicked link', { url: 'https://github.com/smol-ai/developer' })}
                >
                  Learn about smol developer  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
          <div className="relative mb-8 md:mb-8 md:h-full">
            <Image
              className="absolute w-[57rem] top-4 lg:top-1/2 lg:-translate-y-1/2 max-w-none rounded-md bg-white/5 ring-1 ring-white/10"
              // src="https://tailwindui.com/img/component-images/dark-project-app-screenshot.png"
              src="/graphics.png"
              alt="App screenshot"
              width={1824}
              height={1080}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SmolDeveloper