'use client'

import { Auth } from '@supabase/auth-ui-react'
import {
  ThemeSupa,
  ViewType,
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
    <div className="flex flex-1 justify-center items-center flex-col">
      <span className="text-3xl pb-2">
        {view === 'sign_in' && 'Sign in to E2B'}
        {view === 'sign_up' && 'Sign up to E2B'}
        {view === 'forgotten_password' && 'Reset password'}
      </span>
      <div className="flex">
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            // TODO: Customize auth styling — https://supabase.com/docs/guides/auth/auth-helpers/auth-ui#customization
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
        {view !== 'sign_in' && <Button
          onClick={() => setView('sign_in')}
          variant="textSubtle"
        >
          Already have an account? Sign in
        </Button>
        }
        {view === 'sign_in' && <Button
          onClick={() => setView('forgotten_password')}
          variant="textSubtle"
        >
          Forgot your password?
        </Button>
        }
        {view === 'sign_in' && <Button
          onClick={() => setView('sign_up')}
          variant="textSubtle"
        >
          {'Don\'t have an account? Sign up'}
        </Button>
        }
      </div>
    </div >
  )
}

export default AuthForm
