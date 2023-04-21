import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import useSWRMutation from 'swr/mutation'
import { projects } from '@prisma/client'

import { defaultTemplateID, PromptPart, Route } from 'state/store'
import { useLatestDeployment } from 'hooks/useLatestDeployment'
import { useStateStore } from 'state/StoreProvider'
import { ModelConfig, getModelArgs } from 'state/model'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import { defaultPromptTemplate, evaluatePrompt } from 'state/prompt'

import Agent from './Agent'
import Envs from './Envs'
import Model from './Model'
import Prompt from './Prompt'
import { MenuSection } from '../SidebarMenu'

export interface Props {
  project: projects
  activeMenuSection?: MenuSection
}

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    controller: AbortController,
    projectID: string,
    route: Route,
    modelConfig: ModelConfig,
    promptTemplate: PromptPart[],
    envs: { key: string, value: string }[],
  }
}) {
  return await fetch(url, {
    signal: arg.controller.signal,
    method: 'POST',
    body: JSON.stringify({
      projectID: arg.projectID,
      routeID: arg.route.id,
      prompt: evaluatePrompt(
        arg.route.blocks,
        arg.promptTemplate,
        {
          Method: arg.route.method.toLowerCase(),
          Route: arg.route.route,
        },
      ),
      modelConfig: arg.modelConfig,
      envs: arg.envs,
    }),
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
  const model = selectors.use.model()

  const prompt = selectors.use.modelSetups().find(p =>
    p.templateID === defaultTemplateID &&
    p.provider === model.provider &&
    p.modelName === model.name
  )?.prompt || defaultPromptTemplate

  const modelConfig = selectors.use.selectedModelConfig()

  const [creds] = useModelProviderArgs()

  async function deploy() {
    const config = getModelArgs(model, creds)
    if (!config) {
      console.error('Cannot get model config')
      return
    }

    const controller = new AbortController()
    generateController.current = controller

    await generate({
      controller,
      route,
      projectID: project.id,
      promptTemplate: prompt,
      modelConfig: config,
      envs,
    })
  }

  async function cancelGenerate() {
    generateController.current?.abort()
  }

  const [isInitializingDeploy, setIsInitializingDeploy] = useState(false)

  useEffect(function handleDeployState() {
    if (!deployment) return
    setIsInitializingDeploy(false)
  }, [deployment])

  useEffect(function handleDeployState() {
    if (!isDeployRequestRunning) return
    setIsInitializingDeploy(true)
  }, [isDeployRequestRunning])

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
      {/* {activeMenuSection === MenuSection.Deploy &&
        <Deploy />
      } */}
      {/* {activeMenuSection === MenuSection.Context &&
        <Context />
      } */}
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
