import { useRouter } from 'next/router'
import { useSessionContext, useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { useEffect, useState } from 'react'

import Spinner from 'components/Spinner'
import { Github } from 'lucide-react'

function SignIn() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const router = useRouter()
  const sessionCtx = useSessionContext()
  const [isSigningIn, setIsSigningIn] = useState(false)

  const isLoading = isSigningIn || sessionCtx.isLoading || !!sessionCtx.session

  useEffect(() => {
    if (user) {
      router.push({
        pathname: '/',
        query: {
          ...router.query['team'] && { team: router.query['team'] },
        },
      })
    }
  }, [user, router])

  async function signInWithGitHub() {
    try {
      setIsSigningIn(true)
      await supabaseClient.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.href,
          scopes: 'email',
        }
      })
    } catch {
      setIsSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 space-y-8">
      <h1 className="text-center text-4xl font-bold leading-9 tracking-tight text-white">
        e2b
      </h1>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm space-y-4 items-center justify-center">
        <h2 className="text-center text-xl font-bold leading-9 tracking-tight text-white">
          Sign in to your account
        </h2>
        <div className="sm:mx-auto sm:w-full sm:max-w-sm justify-center flex">
          <button
            className="flex items-center space-x-2 rounded-md bg-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all"
            onClick={signInWithGitHub}
            disabled={isLoading}
          >
            {isLoading &&
              <Spinner />
            }
            {!isLoading &&
              <Github size={16} />
            }
            <span className="">Continue with GitHub</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignIn
