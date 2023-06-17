import { useRouter } from 'next/router'
import { usePostHog } from 'posthog-js/react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import AgentList from 'components/AgentList'
import AgentRunsList from 'components/AgentRunsList'
import AgentLogFilesList from 'components/AgentLogFilesList'
import { ProjectWithLogFiles } from 'pages'

export interface Props {
  projects: ProjectWithLogFiles[]
  defaultProjectID: string
}

function DashboardHome({
  projects,
  defaultProjectID,
}: Props) {
  const supabaseClient = useSupabaseClient()
  const router = useRouter()
  const posthog = usePostHog()

  const view = router.query.view as string | undefined
  const selectedAgentInstanceID = router.query.projectID as string | undefined
  const selectedLogFileID = router.query.fileID as string | undefined

  async function signOut() {
    await supabaseClient.auth.signOut()
    posthog?.reset(true)
    router.push('/sign')
  }

  function selectAgent(e: any, projectID: string) {
    e.preventDefault()
    posthog?.capture('selected deployed agent', { projectID: projectID })
    router.push(`/?view=runs&projectID=${projectID}`, undefined, { shallow: true })
  }

  const logs = projects.flatMap(p => p.logs)

  const projectsWithDeployments = projects
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
    }))

  return (
    <>
      {view === 'deployed' ? (
        <AgentList
          agents={projectsWithDeployments}
          onSelectAgent={selectAgent}
        />
      ) : view === 'runs' ? (
        <AgentRunsList
          allDeployedAgents={projectsWithDeployments}
          initialSelectedAgentID={selectedAgentInstanceID}
        />
      ) : view === 'logs' ? (
        <AgentLogFilesList
          logs={logs}
          defaultProjectID={defaultProjectID}
          initialSelectedLogFileID={selectedLogFileID}
        />
      ) : (
        <span>404</span>
      )}
    </>
  )
}

export default DashboardHome