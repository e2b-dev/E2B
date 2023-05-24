import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { useUser } from '@supabase/auth-helpers-react'

import Text from 'components/Text'
import Button from 'components/Button'
import Repos from 'components/Repos'

function SmolDeveloper() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const session = useSession()

  async function signInWithGitHub() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.href,
      }
    })
    console.log({ data, error })
  }

  async function signOut() {
    await supabaseClient.auth.signOut()
  }

  return (
    <div className="
      p-8
      m-auto
      flex-1
      flex
      flex-col
      space-y-4
    ">
      <Text
        size={Text.size.S1}
        text="Smol Developer"
      />

      {user ? (
        <Button
          text="Sign out"
          onClick={signOut}
        />
      ) : (
        <Button
          text="Sign in with GitHub"
          onClick={signInWithGitHub}
        />
      )}

      {user &&
        <Repos
          onRepoSelection={(r) => console.log('selected repo', r)}
          accessToken={session?.provider_token || undefined}
        />
      }
    </div>
  )
}

export default SmolDeveloper