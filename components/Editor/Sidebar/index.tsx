import { useEffect, useState } from 'react'
import clsx from 'clsx'
import useSWRMutation from 'swr/mutation'
import { projects } from '@prisma/client'

import Agent from './Agent'
import Envs from './Envs'
import Model from './Model'

import { defaultTemplateID, PromptPart, Route } from 'state/store'
import { useLatestDeployment } from 'hooks/useLatestDeployment'
import { useStateStore } from 'state/StoreProvider'
import { ModelConfig, getModelConfig } from 'state/model'
import useModelProviderArgs from 'hooks/useModelProviderArgs'
import Prompt from './Prompt'
import { defaultPromptTemplate, evaluatePrompt } from 'state/prompt'
// import Deploy from './Deploy'

export interface Props {
  project: projects
  route?: Route
  activeMenuSection?: MenuSection
}

export enum MenuSection {
  Agent = 'Agent',
  Envs = 'Envs',
  Model = 'Model',
  Prompt = 'Prompt',
  // Context = 'Context',
  // Deploy = 'Deploy',
}

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    projectID: string,
    route: Route,
    modelConfig: ModelConfig,
    promptTemplate: PromptPart[],
    envs: { key: string, value: string }[],
  }
}) {
  return await fetch(url, {
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
  route,
  activeMenuSection,
}: Props) {
  const deployment = useLatestDeployment(project, route)

  const {
    trigger: generate,
    isMutating: isDeployRequestRunning,
  } = useSWRMutation(`${apiURL}/generate`, handlePostGenerate)

  const [selectors] = useStateStore()
  const envs = selectors.use.envs()
  const model = selectors.use.model()
  const prompt = selectors.use.modelSetups().find(p =>
    p.templateID === defaultTemplateID &&
    p.provider === model.provider &&
    p.modelName === model.name
  )?.prompt || defaultPromptTemplate

  const [creds] = useModelProviderArgs()

  async function deploy() {
    if (!route) return
    const config = getModelConfig(model, creds)
    if (!config) {
      console.error('Cannot get model config')
      return
    }

    await generate({
      projectID: project.id,
      route,
      envs,
      promptTemplate: prompt,
      modelConfig: config,
    })
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
          isDeployRequestRunning={isDeployRequestRunning}
          isInitializingDeploy={isInitializingDeploy}
          deployment={deployment}
        />
      }
    </div>
  )
}
export default Sidebar
