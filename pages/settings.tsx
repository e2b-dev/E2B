import { Key, Mail, Settings as SettingsIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import Button from 'components/Button'
import Text from 'components/Text'
import { Database } from 'db/supabase'
import { serverCreds } from 'db/credentials'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { providerTemplates, ModelProvider } from 'state/model'
import Input from 'components/Input'
import { CRED_LABELS } from 'utils/constants'
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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

  const [creds, mergeCreds] = useModelProviderArgs()

  async function handleSignOut() {
    await supabaseClient.auth.signOut()
    router.push('/')
  }

  async function handleCredValidation(cred: any) {
    if (cred.label === CRED_LABELS.OPENAI) {
      const response = await fetch('/api/validation/openapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: creds?.OpenAI?.creds?.openai_api_key
        })
      });
      const data = (await response.json()).data;

      if (data?.error) {
        toast.error(data?.message, {
          position: "bottom-center",
          autoClose: 5000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: false,
          progress: undefined,
          theme: "light",
        });
      } else {
        toast.success(data?.message, {
          position: "bottom-center",
          autoClose: 5000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: false,
          progress: undefined,
          theme: "light",
        });
      }
    }
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
            <Key size="16px" />
            <Text
              size={Text.size.S2}
              text="Keys"
            />
          </div>
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
            {Object.entries(providerTemplates).map(([provider, value]) =>
              <div
                key={provider}
              >
                {Object.entries(value.creds || {}).map(([key, cred]) =>
                  <div key={key}>
                    <Input
                      title={cred.label || key}
                      value={creds[provider as ModelProvider]?.creds?.[key]?.toString()}
                      onChange={(v) => mergeCreds(provider as ModelProvider, key, v || undefined)}
                      onBlur={() => handleCredValidation(cred)}
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
      <ToastContainer />
    </div >
  )
}

export default Settings