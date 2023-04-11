import Radio from 'components/ModelRadio'
import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { allCredsOk, ModelProvider, models } from 'state/model'
import useModelProviderCreds from 'hooks/useModelProviderCreds'
import { useRouter } from 'next/router'

export interface Props { }

function Context({ }: Props) {
  const [selector] = useStateStore()
  const router = useRouter()

  const model = selector.use.model()
  const setModel = selector.use.setModel()

  const [creds, mergeCreds] = useModelProviderCreds()

  return (
    <div className="
      flex
      flex-col
      overflow-hidden
      ">
      <div className="
        flex
        bg-slate-50
        items-center
        justify-between
        border-b
        py-3.5
        pr-4
      ">
        <Text
          text="Model"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />
      </div>
      <div
        className="
        flex
        flex-1
        space-y-2
        p-4
        flex-col
        items-stretch
      "
      >
        {Object.entries(models).map(([provider, value]) =>
          <div
            key={provider}
          >
            <div className="
              flex
              justify-between
              space-x-2
            "
            >
              <Text
                text={provider}
                className="
                  font-semibold
                  uppercase
                  text-slate-400
              "
                size={Text.size.S2}
              />
              <Text
                text={allCredsOk(provider as ModelProvider, creds) ? 'Credentials found' : 'Credentials missing'}
                className="
                  text-slate-400
                  cursor-pointer
                  hover:text-slate-500
                "
                size={Text.size.S3}
                onClick={() => router.push('/settings')}
              />
            </div>
            <div className="
              flex
              items-start
              flex-1
              py-1
            "
            >
              <Radio
                items={value.models}
                select={(i) => setModel({

                  ...i,
                })}
                selected={model}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Context
