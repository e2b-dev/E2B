import clsx from 'clsx'
import { projects } from '@prisma/client'

import { useStateStore } from 'state/StoreProvider'
import { getModelArgs } from 'state/model'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { evaluatePrompt } from 'state/prompt'

import Agent from './Agent'
import Envs from './Envs'
import Model from './Model'
import Prompt from './Prompt'
import { MenuSection } from '../SidebarMenu'

import useAgentRun from 'hooks/useAgentRun'

export interface Props {
  project: projects
  activeMenuSection?: MenuSection
}

function Sidebar({
  project,
  activeMenuSection,
}: Props) {

  const {
    agentRun,
    logs,
    start,
    agentState,
  } = useAgentRun()

  const [selectors] = useStateStore()
  const modelConfig = selectors.use.getSelectedModelConfig()()
  const instructions = selectors.use.instructions()
  const instructionsTransform = selectors.use.instructionsTransform()

  const [creds] = useModelProviderArgs()

  async function run() {
    if (!modelConfig) {
      console.error('Cannot get model config')
      return
    }

    try {
      await start(project.id, {
        ...modelConfig,
        args: getModelArgs(modelConfig, creds) as any,
        prompt: evaluatePrompt(
          instructions,
          instructionsTransform,
          modelConfig.prompt,
        ),
      })

      // setIsDeployRequestRunning(true)
      // await generate({
      //   project_id: project.id,
      //   model_config: {
      //     ...modelConfig,
      //     args: getModelArgs(modelConfig, creds) as any,
      //     prompt: evaluatePrompt(
      //       instructions,
      //       instructionsTransform,
      //       modelConfig.prompt,
      //     ),
      //   },
      // })
    } finally {
      // setIsDeployRequestRunning(false)
    }
  }

  return (
    <div
      className={clsx(`
      flex
      bg-white
      w-full
      flex-col
      min-h-0
      `,
      )}
    >
      {activeMenuSection === MenuSection.Envs &&
        <Envs />
      }
      {activeMenuSection === MenuSection.Model &&
        <Model />
      }
      {activeMenuSection === MenuSection.Prompt &&
        <Prompt />
      }
      {activeMenuSection === MenuSection.Agent &&
        <Agent
          run={run}
          agentState={agentState}
          logs={logs}
          agentRun={agentRun}
        />
      }
    </div>
  )
}
export default Sidebar
