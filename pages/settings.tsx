import { Mail, Settings as SettingsIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'

import Text from 'components/Text'
import Button from 'components/Button'
import { Database } from 'db/supabase'
import { serverCreds } from 'db/credentials'

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const supabase = createServerSupabaseClient<Database>(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session)
    return {
      redirect: {
        destination: '/sign',
        permanent: false,
      },
    }

  return {
    props: {},
  }
}

interface Props { }

function Settings({ }: Props) {
  const user = useUser()
  const router = useRouter()
  const supabaseClient = useSupabaseClient<Database>()

  async function handleSignOut() {
    await supabaseClient.auth.signOut()
    router.push('/')
  }

  return (
    <div
      className="
      flex
      flex-1
      flex-col
      space-y-4
      space-x-0
      p-8
      overflow-hidden
      md:flex-row
      md:space-y-0
      md:space-x-8
      md:p-12
    "
    >
      <div className="
        flex
        items-start
        justify-between
        flex-col
        ">
        <div className="
          items-center
          flex
          space-x-2
        ">
          <SettingsIcon size="30px" />
          <Text
            size={Text.size.S1}
            text="Settings"
          />
        </div>
        <div className="pt-2">
          <Button
            onClick={handleSignOut}
            text="Sign out"
          />
        </div>
      </div>
      <div
        className="
        flex
        overflow-auto
        scroller
        flex-1
        flex-col
        space-y-6
        "
      >
        <div
          className="
        flex
        flex-col
        space-y-1
      "
        >
          <div className="
            flex
            space-x-2
            text-slate-400
            items-center
          ">
            <Mail size="16px" />
            <Text
              size={Text.size.S2}
              text="Email"
            />
          </div>
          <Text
            size={Text.size.S2}
            text={user?.email!}
          />
        </div>
      </div>
    </div>
  )
}

export default Settings
