import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { ModelProvider, modelTemplates } from 'state/model'
import useModelProviderArgs from 'hooks/useModelProviderArgs'

import ProviderCard from './ProviderCard'

export interface Props { }

function Model({ }: Props) {
  const [selector] = useStateStore()
  const model = selector.use.model()
  const [creds] = useModelProviderArgs()

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
          space-y-6
          p-4
          flex-col
          overflow-auto
          items-stretch
          scroller
        "
      >
        {Object.entries(modelTemplates).map(([provider, value], i, a) =>
          <div
            key={provider}
            className="
              flex
              flex-col
            "
          >
            <ProviderCard
              selectedModel={model}
              creds={creds}
              template={value}
              provider={provider as ModelProvider}
            />
            {i !== a.length - 1 &&
              <div className="
                w-full
                border-b
                border-slate-300
                pt-4
              " />}
          </div>
        )}
      </div>
    </div>
  )
}

export default Model
