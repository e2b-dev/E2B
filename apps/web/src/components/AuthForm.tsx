'use client'

import Link from 'next/link'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa, ViewType } from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'

const supabase = createClientComponentClient()

export interface Props {
  view: ViewType
}

function AuthForm({ view }: Props) {
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get('redirect_to') || undefined
  const router = useRouter()
  const user = useUser()

  useEffect(
    function redirect() {
      if (user.user && redirectTo) {
        router.push(redirectTo)
      }

      if (user.wasUpdated && !redirectTo) {
        router.push('/dashboard')
      }
    },
    [user.user, router, redirectTo, view, user.wasUpdated]
  )

  return (
    <div className="mx-auto flex flex-1 w-full justify-center items-center flex-col pt-4">
      <h1 className="text-4xl font-bold mt-8 mb-4">
        {view === 'sign_in' && 'Sign in to E2B'}
        {view === 'sign_up' && 'Create new E2B account'}
        {view === 'forgotten_password' && 'Reset password'}
        {view === 'update_password' && 'Update password'}
      </h1>
      <div className="md:w-[420px] w-[240px]">
        <Auth
          otpType={view === 'update_password' ? 'recovery' : undefined}
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            extend: true,
            className: {
              button: 'auth-button',
              divider: 'auth-divider',
              message: 'auth-message',
            },
          }}
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email address',
                password_label: 'Password',
              },
            },
          }}
          view={view}
          theme="dark"
          showLinks={false}
          providers={['github', 'google']}
          providerScopes={{
            github: 'email',
          }}
          redirectTo={
            view === 'forgotten_password'
              ? 'https://e2b.dev/auth/update-password'
              : redirectTo
          }
        />
      </div>

      <div className="flex flex-1 flex-col pt-4">
        {(view === 'sign_up' ||
          view === 'forgotten_password' ||
          view === 'update_password') && (
          <div className="flex items-center justify-start gap-2">
            <span className="text-zinc-400">Already have an account?</span>
            <Link
              className="flex items-center justify-center"
              href={`/auth/sign-in?redirect_to=${redirectTo}`}
            >
              <Button variant="textLink">Sign in</Button>
            </Link>
          </div>
        )}

        {view === 'sign_in' && (
          <Link className="text-center" href="/auth/reset-password">
            <Button variant="textSubtle">Forgot your password?</Button>
          </Link>
        )}

        {view === 'sign_in' && (
          <div className="flex items-center justify-start gap-2">
            <span className="text-zinc-400">{"Don't have an account?"}</span>
            <Link href={`/auth/sign-up?redirect_to=${redirectTo}`}>
              <Button variant="textLink">Sign up</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthForm
