import { Settings as SettingsIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'

import Button from 'components/Button'
import Text from 'components/Text'
import { Database } from 'db/supabase'
import { serverCreds } from 'db/credentials'
import useModelProviderCreds from 'hooks/useModelProviderCreds'
import { models, ModelProvider } from 'state/model'
import Input from 'components/Input'

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

  const [creds, mergeCreds] = useModelProviderCreds()

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
      overflow-hidden
      p-8
      md:flex-row
      md:space-y-0
      md:space-x-8
      md:p-12
    "
    >
      <div className="flex items-start justify-start">
        <div className="items-center flex space-x-2">
          <SettingsIcon size="30px" />
          <Text
            size={Text.size.S1}
            text="Settings"
          />
        </div>
      </div>

      <div
        className="
        flex
        flex-1
        flex-col
        items-start
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
          <Text
            className="text-slate-400"
            size={Text.size.S2}
            text="Email"
          />
          <Text
            size={Text.size.S2}
            text={user?.email!}
          />
        </div>
        <div
          className="
        flex
        flex-col
        space-y-1
      "
        >
          <Text
            className="text-slate-400"
            size={Text.size.S2}
            text="Keys"
          />
          <div
            className="
                flex
                pt-1
                flex-col
                space-y-3
                flex-1
                w-[450px]
              "
          >
            {Object.entries(models).map(([provider, value]) =>
              <div
                key={provider}
              >
                {Object.entries(value.creds || {}).map(([key, cred]) =>
                  <div key={key}>
                    <Input
                      title={cred.label || key}
                      value={creds[provider as ModelProvider]?.creds?.[key]?.toString()}
                      onChange={(v) => mergeCreds(provider as ModelProvider, key, v || undefined)}
                      placeholder={cred.label}
                      label={cred.label}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="pt-2">
          <Button
            onClick={handleSignOut}
            text="Sign out"
          />
        </div>
      </div>
    </div >
  )
}

export default Settings
