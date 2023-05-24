import { useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@supabase/auth-helpers-react'

import Text from 'components/Text'
import Button from 'components/Button'
import GitHubButton from 'components/GitHubButton'

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
      justify-start
      space-y-4
    ">
      <div className="
        flex
        space-x-1
      ">
        <Text
          size={Text.size.S1}
          text="Get your own"
        />
        <div className="
          relative
          group
        ">
          <a
            href="https://github.com/smol-ai/developer"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Text
              size={Text.size.S1}
              className="text-green-800 font-semibold"
              text="smol developer"
            />
          </a>
          <div className="
            absolute
            w-full
            h-px
            bg-green-800
            bottom-0
            left-0
            transition-all
            rounded
            group-hover:translate-y-[2px]
          "/>
        </div>
        <Text
          size={Text.size.S1}
          text="with e2b"
        />
      </div>

      {user ? (
        <Button
          text="Sign out"
          onClick={signOut}
        />
      ) : (
        <GitHubButton
          onClick={signInWithGitHub}
        />
      )}
    </div>
  )
}

export default SmolDeveloper