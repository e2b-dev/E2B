import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import useSWRMutation from 'swr/mutation'
import { projects } from '@prisma/client'

import { useLatestDeployment } from 'hooks/useLatestDeployment'
import { useStateStore } from 'state/StoreProvider'
import { ModelConfig, getModelArgs } from 'state/model'
import useModelProviderArgs, { Creds } from 'hooks/useModelProviderArgs'
import { evaluatePrompt } from 'state/prompt'

import Agent from './Agent'
import Envs from './Envs'
import Model from './Model'
import Prompt from './Prompt'
import { MenuSection } from '../SidebarMenu'
import { EnvVar } from 'state/envs'
import { Instructions, InstructionsTransform } from 'state/instruction'

export interface Props {
  project: projects
  activeMenuSection?: MenuSection
}

interface PostGenerateBody {
  projectID: string
  modelConfig: ModelConfig
  envs: EnvVar[]
}

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    controller: AbortController,
    creds: Creds,
    projectID: string,
    modelConfig: ModelConfig,
    instructions: Instructions,
    instructionsTransform: InstructionsTransform,
    envs: EnvVar[],
  }
}) {
  const body: PostGenerateBody = {
    projectID: arg.projectID,
    modelConfig: {
      ...arg.modelConfig,
      args: getModelArgs(arg.modelConfig, arg.creds),
      prompt: evaluatePrompt(
        arg.instructions,
        arg.instructionsTransform,
        arg.modelConfig.prompt,
      ),
    },
    envs: arg.envs,
  }

  return await fetch(url, {
    signal: arg.controller.signal,
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

const apiURL = process.env.NEXT_PUBLIC_PROXY
  ? '/api/service'
  : process.env.NEXT_PUBLIC_API_URL

function Sidebar({
  project,
  activeMenuSection,
}: Props) {
  const deployment = useLatestDeployment(project)

  const {
    trigger: generate,
    isMutating: isDeployRequestRunning,
  } = useSWRMutation(`${apiURL}/generate`, handlePostGenerate)

  const generateController = useRef<AbortController | null>(null)

  const [selectors] = useStateStore()
  const envs = selectors.use.envs()
  const modelConfig = selectors.use.getSelectedModelConfig()()
  const instructions = selectors.use.instructions()
  const instructionsTransform = selectors.use.instructionsTransform()

  const [creds] = useModelProviderArgs()

  const [isInitializingDeploy, setIsInitializingDeploy] = useState(false)

  useEffect(function handleDeployState() {
    if (!deployment) return
    setIsInitializingDeploy(false)
  }, [deployment])

  useEffect(function handleDeployState() {
    if (!isDeployRequestRunning) return
    setIsInitializingDeploy(true)
  }, [isDeployRequestRunning])

  async function deploy() {
    if (!modelConfig) {
      console.error('Cannot get model config')
      return
    }

    const controller = new AbortController()
    generateController.current = controller

    await generate({
      controller,
      projectID: project.id,
      modelConfig,
      creds,
      instructions,
      instructionsTransform,
      envs,
    })
  }

  function cancelGenerate() {
    generateController.current?.abort()
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
          deploy={deploy}
          cancel={cancelGenerate}
          isDeployRequestRunning={isDeployRequestRunning}
          isInitializingDeploy={isInitializingDeploy}
          deployment={deployment}
        />
      }
    </div>
  )
}
export default Sidebar
