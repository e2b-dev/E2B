import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { ModelProvider, modelTemplates, ProviderTemplate } from 'state/model'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { sortByOrder } from 'utils/sortByOrder'

import ProviderCard from './ProviderCard'

const modelProviderOrder = sortByOrder<ModelProvider, [string, ProviderTemplate]>(
  [
    ModelProvider.OpenAI,
    ModelProvider.Anthropic,
    ModelProvider.HuggingFace,
    ModelProvider.Replicate,
  ], i => i[0] as ModelProvider)

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
          space-y-4
          p-4
          flex-col
          overflow-auto
          items-stretch
          scroller
        "
      >
        {Object
          .entries(modelTemplates)
          .slice()
          .sort(modelProviderOrder)
          .map(([provider, template], i, a) =>
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
                template={template}
                provider={provider as ModelProvider}
              />
              {i !== a.length - 1 &&
                <div className="
                  w-full
                  border-b
                  border-slate-300
                  pt-2
                "
                />}
            </div>
          )}
      </div>
    </div>
  )
}

export default Model
