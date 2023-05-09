import { memo } from 'react'

import api from 'api-client/api'
import Text from 'components/Text'
import { projects } from 'db/prisma'
import { useStateStore } from 'state/StoreProvider'
import { evaluatePrompt } from 'state/prompt'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { getModelArgs } from 'state/model'


const createDeployment = api.path('/deployments').method('put').create({
  project_id: true,
})

export interface Props {
  project: projects
}

function Deploy({ project }: Props) {
  const [selectors] = useStateStore()
  const modelConfig = selectors.use.getSelectedModelConfig()()

  const [creds] = useModelProviderArgs()

  async function deployAgent() {
    if (!modelConfig) {
      console.error('Cannot get model config')
      return
    }
    const {
      references: promptReferences,
      prompt: evaluatedPrompt,
    } = evaluatePrompt(modelConfig.prompt)

    createDeployment({
      // TODO: Add current envs vars and save them on backend
      project_id: project.id,
      config: {
        name: modelConfig.name,
        provider: modelConfig.provider,
        args: getModelArgs(modelConfig, creds) as any,
        prompt: evaluatedPrompt,
        // TODO: Handle prompt references
        prompt_references: promptReferences,
      } as any,
    })
  }

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
          text="Deploy"
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
      p-4
      space-y-4
      "
      >

      </div>
    </div>
  )
}

export default memo(Deploy)
