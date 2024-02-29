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
    <div className="mx-auto flex flex-1 max-w-[320px] justify-center items-center flex-col">
      <h1 className="text-4xl font-bold mt-8 mb-4">
        {view === 'sign_in' && 'Sign in to E2B'}
        {view === 'sign_up' && 'Sign up to E2B'}
        {view === 'forgotten_password' && 'Reset password'}
      </h1>
      <div className="flex">
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
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
      <div className="flex flex-1 flex-col space-x-2">
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

        {view === 'sign_in' &&
          <Button
            onClick={() => setView('forgotten_password')}
            variant="textSubtle"
          >
            Forgot your password?
          </Button>
        }

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
