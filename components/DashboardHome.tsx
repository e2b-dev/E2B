import AgentLogFilesList from 'components/AgentLogFilesList'
import { deployments, projects } from 'db/prisma'
import { useMemo } from 'react'
import { LiteLogUpload } from 'utils/agentLogs'

export interface Props {
  projects: (projects & { log_uploads: LiteLogUpload[], deployments: deployments[] })[]
  defaultProjectID: string
  view: 'deployments' | 'uploads'
}

function DashboardHome({
  projects,
  defaultProjectID,
  view,
}: Props) {

  const projectsWithDeployments = useMemo(() => projects
    .filter(p => {
      if (p.deployments.length !== 1) return false

      const deployment = p.deployments[0]
      const auth = deployment.auth as any
      if (!auth) return false
      return deployment.enabled
    })
    .map(p => ({
      project: p,
      deployment: p.deployments[0],
    })), [projects])

  return (
    <>
      {view === 'deployments' &&
        <AgentLogFilesList
          logUploads={projects.flatMap(p => p.deployments)}
          defaultProjectID={defaultProjectID}
        />
      }
      {view === 'uploads' &&
        <AgentLogFilesList
          logUploads={projects.flatMap(p => p.log_uploads)}
          defaultProjectID={defaultProjectID}
        />
      }
    </>
  )
}

export default DashboardHome
