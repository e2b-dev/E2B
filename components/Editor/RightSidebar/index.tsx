import { projects } from '@prisma/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Log } from 'db/types'
import Sidebar from 'components/Sidebar'
import Text from 'components/Text'
import { Route } from 'state/store'
import { useLatestDeployment } from 'hooks/useLatestDeployment'

import DeployButton from './DeployButton'
import Logs from './Logs'
import Envs from './Envs'

export interface Props {
  deploy: () => void
  isDeployRequestRunning?: boolean
  setDeployURL: (url: string | undefined) => void

  project: projects
  route?: Route
}

function RightSidebar({
  isDeployRequestRunning,
  deploy,
  project,
  route,
  setDeployURL,
}: Props) {
  const deployment = useLatestDeployment(project, route)
  const logs = deployment?.logs as Log[] | undefined
  const logsRaw = deployment?.logs_raw as string | undefined

  useEffect(function updateURL() {
    setDeployURL(deployment?.url ? deployment.url : undefined)
  }, [deployment?.url, setDeployURL])

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
    <Sidebar
      side={Sidebar.side.Right}
      className="
        flex
        flex-col
        min-h-0
      "
    >
      <div
        className="
        flex
        px-4
        py-2
        justify-start
        border-b
        flex-col
      "
      >
        <div
          className="
            flex
            flex-1
            items-center
            justify-between
          "
        >
          <Text
            text="Latest Deployment"
            className="
              font-semibold
              uppercase
              text-slate-400
            "
            size={Text.size.S2}
          />
          <DeployButton
            deploy={deploy}
            isDeployRequestRunning={isDeployRequestRunning}
            isInitializingDeploy={isInitializingDeploy}
            deployStatus={deployment?.state}
          />
        </div>
        {deployment?.url &&
          <Link
            href={deployment.url}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text
              size={Text.size.S3}
              text={deployment.url.substring('https://'.length)}
            />
          </Link>
        }
        {!deployment?.url &&
          <Text
            text="No deployment URL found"
            size={Text.size.S3}
            className="text-slate-400"
          />
        }
      </div>
      <Envs />
      <Logs
        logs={logs}
        logsRaw={logsRaw}
      />
    </Sidebar>
  )
}

export default RightSidebar
