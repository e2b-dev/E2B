'use client'

import { Auth } from '@supabase/auth-ui-react'
import {
  ViewType,
  ThemeSupa,
} from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'

const supabase = createClientComponentClient()

function getView(hash: string): ViewType {
  switch (hash) {
    case 'sign-in':
      return 'sign_in'
    case 'sign-up':
      return 'sign_up'
    case 'forgotten-password':
      return 'forgotten_password'
    default:
      return 'sign_in'
  }
}

function AuthForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect_to')
  const paramView = searchParams.get('view')
  const router = useRouter()

  const [view, setView] = useState<ViewType>(getView(paramView))

  const user = useUser()

  useEffect(function redirect() {
    if (user.user) {
      router.push(redirectTo)
    }
  }, [user.user, router, redirectTo])

  return (
    <div className="mx-auto flex flex-1 w-full justify-center items-center flex-col pt-4">
      <h1 className="text-4xl font-bold mt-8 mb-4">
        {view === 'sign_in' && 'Sign in to E2B'}
        {view === 'sign_up' && 'Create new E2B account'}
        {view === 'forgotten_password' && 'Reset password'}
      </h1>
      <div className="md:w-[420px] w-[240px]">
        <Auth
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
          providers={['github']}
          providerScopes={{
            github: 'email',
          }}
          redirectTo={redirectTo}
        />
      </div>
      <div className="flex flex-1 flex-col pt-4">
        {view === 'sign_up' &&
          <div className="flex items-center justify-start gap-2">
            <span className="text-zinc-400">Already have an account?</span>
            <Button
              onClick={() => setView('sign_in')}
              variant="textLink"
            >
              Sign in
            </Button>
          </div>
        }

        {/* {view === 'sign_in' &&
          <Button
            onClick={() => setView('forgotten_password')}
            variant="textSubtle"
          >
            Forgot your password?
          </Button>
        } */}

        {view === 'sign_in' &&
          <div className="flex items-center justify-start gap-2">
            <span className="text-zinc-400">{'Don\'t have an account?'}</span>
            <Button
              onClick={() => setView('sign_up')}
              variant="textLink"
            >
              Sign up
            </Button>
          </div>
        }
      </div>
    </div >
  )
}

export default AuthForm
