import type { GetServerSideProps } from 'next'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import {
  useUser,
  useSession,
} from '@supabase/auth-helpers-react'

import { serverCreds } from 'db/credentials'
import Repos from 'components/Repos'
import Button from 'components/Button'


export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: {
        destination: '/agent/smol-developer',
        permanent: false,
      },
    }
  }
  return { props: {} }
}

function Repo() {
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const session = useSession()
  const sessionCtx = useSessionContext()

  async function signOut() {
    await supabaseClient.auth.signOut()
    location.reload()
  }

  return (
    <div
      className="
      p-8
      flex-1
      flex
      flex-col
      space-y-4
    "
    >
      <div
        className="
      max-w-xl
      w-full
      flex-1
      flex
      flex-col
      self-center
      justify-center
      space-y-4
    "
      >
        Select repo
        {user &&
          <Repos
            onRepoSelection={r => console.log(r)}
            accessToken={session?.provider_token || undefined}
          />
        }
      </div>
      {!sessionCtx.isLoading && user && (
        <Button
          text="Sign out"
          onClick={signOut}
        />
      )}
    </div>
  )
}

export default Repo
