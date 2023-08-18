import { useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

import { log_uploads, projects } from 'db/prisma'
import { LiteDeployment } from 'utils/agentLogs'
const AgentDeploymentsList = dynamic(() => import('components/AgentDeploymentsList'), { ssr: false })
const AgentLogFilesList = dynamic(() => import('components/AgentLogFilesList'), { ssr: false })

export interface Props {
  projects: (projects & { log_uploads: log_uploads[], deployments: LiteDeployment[] })[]
  defaultProjectID: string
  view: 'deployments' | 'logs'
}

function DashboardHome({
  projects,
  defaultProjectID,
  view,
}: Props) {
  const router = useRouter()
  const showView = router.query['view'] === 'logs' ? 'logs' : view

  const deployments = useMemo(() => projects
    .filter(p => {
      if (p.deployments.length !== 1) return false

      const deployment = p.deployments[0]
      const auth = deployment.auth as any
      if (!auth) return false
      return true
    })
    .flatMap(p => p.deployments)
    , [projects])

  return (
    <>
      {showView === 'deployments' &&
        <AgentDeploymentsList
          deployments={deployments}
        />
      }
      {showView === 'logs' &&
        <AgentLogFilesList
          logUploads={projects.flatMap(p => p.log_uploads)}
          defaultProjectID={defaultProjectID}
        />
      }
    </>
  )
}

export default DashboardHome
