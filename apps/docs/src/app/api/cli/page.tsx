'use client'

import { useSearchParams } from 'next/navigation'
import { useApiKey, useUser } from '@/utils/useUser'
import { DialogAnimated } from '@/components/DialogAnimated'
import { CloudIcon, LaptopIcon, Link2Icon } from 'lucide-react'
import { Button } from '@/components/Button'
import { useSignIn } from '@/utils/useSignIn'

type UserConfig = {
  email: string
  accessToken: string
  defaultTeamApiKey: string
  defaultTeamId: string
}

export default function Page() {
  const signIn = useSignIn()
  const { user, isLoading: userIsLoading } = useUser()
  const apiKey = useApiKey()
  const searchParams = useSearchParams()
  const searchParamsObj = Object.fromEntries(searchParams)
  const { next, state } = searchParamsObj

  // TODO: Consider sending back onetime code to be used to get access token
  function redirectToCli() {
    if (!next) return
    if (!(user?.email && apiKey)) return
    const { email, accessToken, defaultTeamId } = user
    const newUrl = new URL(next)
    const searchParamsObj: UserConfig = {
      email,
      defaultTeamApiKey: apiKey,
      accessToken,
      defaultTeamId,
    }
    newUrl.search = new URLSearchParams(searchParamsObj).toString()
    window.location.href = newUrl.toString()
  }

  let content
  if (state === 'error') {
    content = (
      <>
        <div className="font-bold text-red-500">Error</div>
        <div>Something went wrong, please try again</div>
        <pre>{searchParamsObj.error}</pre> {/* TODO: Nicer, but it should never happen */}
      </>
    )
  } else if (state === 'success') {
    content = (
      <>
        <div className="font-bold text-emerald-400">Successfully linked</div>
        <div>You can close this page and start using CLI.</div>
      </>
    )
  } else {
    const isNextValid = next.startsWith('http://localhost')
    if (!isNextValid) {
      content = (
        <>
          <div className="font-bold text-red-500">Error</div>
          <div>Invalid redirect URL, only localhost is allowed</div>
        </>
      )
    } else if (userIsLoading) {
      content = <span className="text-gray-300">Loading, please wait</span>
    } else if (!user) {
      content = (
        <>
          <Button onClick={() => signIn()}>Sign In to continue</Button>
        </>
      )
    } else {
      content = (
        <>
          <Button onClick={() => redirectToCli()}>
            Authorize CLI to use your account
          </Button>
        </>
      )
    }
  }

  return (
    <div>
      {/* It's not easy to override RootLayout without grouping everything into `(root)` dir */}
      {/* So I'm hacking custom layout with full modal overlay */}
      {/* https://github.com/vercel/next.js/issues/50591 */}
      <DialogAnimated
        open={true}
        setOpen={() => {}} // intentionally prevent closing
      >
        <div className="py-6 sm:py-12">
          <div className="mx-auto px-6 lg:px-8">
            <div className="mx-auto sm:text-center">
              <p
                className="
                flex items-center justify-center gap-4
                text-3xl font-bold tracking-tight sm:text-4xl
              "
              >
                <span className="text-gray-200">
                  <LaptopIcon size={60} />
                </span>
                <span className="text-gray-400">
                  <Link2Icon size={30} />
                </span>
                <span className="text-gray-200">
                  <CloudIcon size={60} />
                </span>
              </p>
              <h2 className="mt-6 text-base font-semibold leading-7">
                Linking CLI with your account
              </h2>
              <p className="mt-12 leading-8">{content}</p>
            </div>
          </div>
        </div>
      </DialogAnimated>
    </div>
  )
}
