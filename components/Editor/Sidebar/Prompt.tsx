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
      <div className="
        flex
        flex-col
        scroller
        flex-1
        overflow-y-auto
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
              title={p.role + ' ' + p.type}
              placeholder={`Specify ${p.role} ${p.type} prompt here`}
              content={p.content}
              onChange={(content) => {
                if (modelSetup) {
                  const p = modelSetup.prompt[i]
                  p.content = content
                  setPrompt(defaultTemplateID, model.provider, model.name, modelSetup.prompt)
                }
              }}
            />

            {/* <CodeEditor
              content={p.content}
              supportedLanguages={supportedLanguages}
              filename="prompt"
              theme={theme}
              onContentChange={(content) => {
                if (modelSetup) {
                  const p = modelSetup.prompt[i]
                  p.content = content
                  setPrompt(defaultTemplateID, model.provider, model.name, modelSetup.prompt)
                }
              }}
            /> */}
          </div>
        )}
      </div>
    </div>
  )
}

export default Prompt
