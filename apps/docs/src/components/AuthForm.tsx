'use client'

import { Auth } from '@supabase/auth-ui-react'
import {
  ThemeSupa,

} from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSearchParams } from 'next/navigation'

const supabase = createClientComponentClient()

function AuthForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect_to')

  return (
    <div className="flex flex-1 items-center">
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
        }}
        theme="dark"
        providers={['github']}
        providerScopes={{
          github: 'email',
        }}
        redirectTo={redirectTo}
      />
    </div>
  )
}

export default AuthForm
