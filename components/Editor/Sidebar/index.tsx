import clsx from 'clsx'
import { projects, deployments } from '@prisma/client'

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
  project: projects & {
    deployments: deployments[];
  }
  activeMenuSection?: MenuSection
}

function Sidebar({
  project,
  activeMenuSection,
}: Props) {
  const {
    agentRun,
    logs: newLogs,
    start,
    agentState,
  } = useAgentRun()
  const [selectors] = useStateStore()
  const modelConfig = selectors.use.getSelectedModelConfig()()
  const instructions = selectors.use.instructions()
  const instructionsTransform = selectors.use.instructionsTransform()

  const [creds] = useModelProviderArgs()

  const lastRunLogs = project.deployments.length === 1 ? project.deployments[0] : undefined
  const logs = newLogs || lastRunLogs

  async function run() {
    if (!modelConfig) {
      console.error('Cannot get model config')
      return
    }

    await start(project.id, {
      ...modelConfig,
      args: getModelArgs(modelConfig, creds) as any,
      prompt: evaluatePrompt(
        instructions,
        instructionsTransform,
        modelConfig.prompt,
      ),
    })
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
