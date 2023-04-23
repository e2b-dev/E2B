import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { getPromptLabel } from 'state/prompt'
import { providerIcons } from 'components/icons/ProviderIcon'

import Editor from './PromptEditor'

function Prompt() {
  const [selectors] = useStateStore()
  const model = selectors.use.selectedModel()
  const modelConfig = selectors.use.getSelectedModelConfig()()

  return (
    <div className="
    flex
    flex-col
    flex-1
    overflow-hidden
  ">
      <div className="
        flex
        bg-slate-50
        items-center
        border-b
        py-3.5
        px-4
        space-x-4
      ">
        <Text
          text="Prompt"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
          "
        />
      </div>
      <div
        className="
        border-slate-100
        py-2
        px-4
        border-b
        space-x-2
        justify-between
        font-medium
        flex
        "
      >
        <div className="
            flex
            items-center
            space-x-2
          ">
          {providerIcons[model.provider]}
          <Text
            text={model.provider}
            className="
            text-slate-400
          "
            size={Text.size.S2}
          />
        </div>
        <Text
          text={model.name}
        />
      </div>
      <div
        className="
        py-8
        px-4
        flex
        flex-1
        bg-white
        justify-center
        overflow-auto
        scroller
        "
      >
        <div className="
      flex
      flex-col
      space-y-6
      max-w-[65ch]
      grow
      ">
          {modelConfig?.prompt.map((p, i) =>
            <div
              key={i}
              className="
                flex
                space-y-4
                flex-col
              "
            >
              <div className="flex flex-col">
                <Text
                  className="font-bold text-slate-400"
                  size={Text.size.S2}
                  text={`${p.role} ${p.type.replace(/([A-Z])/g, ' $1')}`.toUpperCase()}
                />
                <Text
                  className="font-medium text-slate-400"
                  size={Text.size.S3}
                  text={getPromptLabel(p)}
                />
              </div>
              <Editor
                placeholder={`Specify ${p.role} ${p.type.replace(/([A-Z])/g, ' $1').toLowerCase()} prompt here`}
                content={p.content}
                modelConfig={modelConfig}
                idx={i}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Prompt
