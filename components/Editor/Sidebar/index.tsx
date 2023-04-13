import { useEffect, useState } from 'react'
import clsx from 'clsx'
import useSWRMutation from 'swr/mutation'
import { projects } from '@prisma/client'

import Agent from './Agent'
import Envs from './Envs'
import Model from './Model'

import { Route, Block } from 'state/store'
import { useLatestDeployment } from 'hooks/useLatestDeployment'
import { useStateStore } from 'state/StoreProvider'
import { html2markdown } from 'editor/schema'
import { ModelConfig, getModelConfig } from 'state/model'
import useModelProviderCreds from 'hooks/useModelProviderCreds'
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
  // Context = 'Context',
  // Deploy = 'Deploy',
}

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    projectID: string,
    route: Route,
    modelConfig: ModelConfig,
    envs: { key: string, value: string }[],
  }
}) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      projectID: arg.projectID,
      routeID: arg.route.id,
      // Transform block with structured prose into block with plain prompt text.
      blocks: arg.route.blocks.map(b => {
        switch (b.type) {
          case 'Description':
          case 'Instructions':
            const [markdown, references] = html2markdown(b.content)
            const block: Block = {
              ...b,
              content: markdown,
            }
            return block
          default:
            return b
        }
      }),
      modelConfig: arg.modelConfig,
      method: arg.route.method.toLowerCase(),
      route: arg.route.route,
      envs: arg.envs,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

function Sidebar({
  project,
  route,
  activeMenuSection,
}: Props) {
  const deployment = useLatestDeployment(project, route)

  const {
    trigger: generate,
    isMutating: isDeployRequestRunning,
  } = useSWRMutation('/api/service/generate', handlePostGenerate)

  const [selectors] = useStateStore()
  const envs = selectors.use.envs()
  const model = selectors.use.model()

  const [creds] = useModelProviderCreds()

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
