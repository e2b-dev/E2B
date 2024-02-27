'use client'

import { Auth } from '@supabase/auth-ui-react'
import {
  ThemeSupa,

} from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

function AuthForm() {
  const url = typeof window !== 'undefined' ? window.location.href : undefined

  return (
    <div className="flex flex-1 items-center">
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
        }}
        theme="dark"
        providers={['github']}
        queryParams={{
          redirect_to: url,
        }}
        providerScopes={{
          github: 'email',
        }}
      />
    </div>
  )
}

export default AuthForm
