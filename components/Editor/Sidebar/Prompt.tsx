import { LanguageSetup } from '@devbookhq/code-editor'
import type { Extension } from '@codemirror/state'

import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { defaultPromptTemplate } from 'state/prompt'
import { defaultTemplateID } from 'state/store'
import PromptEditor from '../RouteEditor/PromptEditor'

export interface Props {


}

const supportedLanguages: LanguageSetup[] = []
const theme: Extension = []

function Prompt({
}: Props) {
  const [selectors] = useStateStore()
  const model = selectors.use.model()
  const setPrompt = selectors.use.setPrompt()
  const modelSetup = selectors.use.modelSetups().find(p =>
    p.templateID === defaultTemplateID &&
    p.provider === model.provider &&
    p.modelName === model.name
  )
  const prompt = modelSetup?.prompt || defaultPromptTemplate

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
        justify-between
        border-b
        py-3.5
        pr-4
      ">
        <Text
          text="Prompt"
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
          {prompt.map((p, i) =>
            <div
              key={i}
              className="
            flex
            flex-col
          "
            >
              <PromptEditor
                title={`${p.role} ${p.type.replace(/([A-Z])/g, ' $1')}`.toUpperCase()}
                placeholder={`Specify ${p.role} ${p.type} prompt here`}
                content={p.content}
                onChange={(content) => {
                  if (modelSetup) {
                    const newPrompt = modelSetup.prompt.slice()
                    newPrompt[i] = {
                      ...newPrompt[i],
                      content
                    }
                    setPrompt(defaultTemplateID, model.provider, model.name, newPrompt)
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Prompt
