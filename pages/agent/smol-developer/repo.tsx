import type { GetServerSideProps } from 'next'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import {
  useUser,
  useSessionContext,
} from '@supabase/auth-helpers-react'

import { serverCreds } from 'db/credentials'
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
  const sessionCtx = useSessionContext()
  const user = useUser()

  async function signOut() {
    await supabaseClient.auth.signOut()
    location.reload()
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
      Select repo
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