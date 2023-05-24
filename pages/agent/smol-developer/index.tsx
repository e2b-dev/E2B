import type { GetServerSideProps } from 'next'
import { useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import {
  useUser,
  useSessionContext,
} from '@supabase/auth-helpers-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

import Text from 'components/Text'
import GitHubButton from 'components/GitHubButton'
import SpinnerIcon from 'components/Spinner'
import { serverCreds } from 'db/credentials'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    return {
      redirect: {
        destination: '/agent/smol-developer/repo',
        permanent: false,
      },
    }
  }
  return { props: {} }
}

function SmolDeveloper() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const sessionCtx = useSessionContext()

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

      {sessionCtx.isLoading && (
        <div
          className="
            flex
            justify-center
          "
        >
          <SpinnerIcon className="text-slate-400" />
        </div>
      )}
      {!sessionCtx.isLoading && !user && (
        <GitHubButton
          onClick={signInWithGitHub}
        />
      )}
    </div>
  )
}

export default SmolDeveloper