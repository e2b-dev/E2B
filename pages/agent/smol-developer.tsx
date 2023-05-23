import { useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@supabase/auth-helpers-react'

import Text from 'components/Text'
import Button from 'components/Button'

function SmolDeveloper() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()

  useEffect(function checkUser() {
    console.log('user', user)
  }, [user])

  async function signInWithGitHub() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.href,
        scopes: 'repo',
      }
    })
    console.log({ data, error })
  }

  return (
    <div className="
      p-8
      m-auto
      flex-1
      flex
      flex-col
      justify-start
      space-y-4
    ">
      <Text
        size={Text.size.S1}
        text="Smol Developer"
      />

      <Button
        text="Sign in with GitHub"
        onClick={signInWithGitHub}
      />
    </div>
  )
}

export default SmolDeveloper