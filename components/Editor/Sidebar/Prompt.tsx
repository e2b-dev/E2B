import { CodeEditor, LanguageSetup } from '@devbookhq/code-editor'
import type { Extension } from '@codemirror/state'

import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { defaultPromptTemplate } from 'state/prompt'

export interface Props {


}

const supportedLanguages: LanguageSetup[] = []
const theme: Extension = []

function Prompt({
}: Props) {
  const [selectors] = useStateStore()
  const model = selectors.use.model()
  const prompt = selectors.use.prompts().find(p =>
    p.templateID === 'NodeJSServer' &&
    p.provider === model.provider &&
    p.modelName === model.name
  )

  const promptParts = prompt?.prompt || defaultPromptTemplate

  const setPrompt = selectors.use.setPrompt()

  return (
    <div className="
    flex
    flex-col
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
        overflow-auto
      ">
        {promptParts.map((p, i) =>
          <div
            key={i}
            className="
            flex
            flex-col
          "
          >
            <div className="
            flex
            space-x-2
          ">
              <Text
                text={p.role}
                className="font-bold"
                size={Text.size.S3}
              />
              <Text
                text={p.type}
                className="font-bold"
                size={Text.size.S3}
              />
            </div>
            <CodeEditor
              content={p.content}
              supportedLanguages={supportedLanguages}
              filename="prompt"
              theme={theme}
              onContentChange={(content) => {
                if (prompt) {
                  const p = prompt.prompt[i]
                  p.content = content

                  setPrompt('NodeJSServer', model.provider, model.name, prompt.prompt)
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Prompt
