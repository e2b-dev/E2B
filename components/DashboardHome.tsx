import { useRouter } from 'next/router'
import { usePostHog } from 'posthog-js/react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import { projects } from 'db/prisma'
import AgentList from 'components/AgentList'
import AgentRunsList from 'components/AgentRunsList'
import { LogFile } from 'utils/agentLogs'


export interface Props {
  projects: (projects & { logs: LogFile[] })[]
}

function DashboardHome({
  projects,
}: Props) {
  const supabaseClient = useSupabaseClient()
  const router = useRouter()
  const posthog = usePostHog()

  const view = router.query.view as string | undefined
  const selectedAgentInstanceID = router.query.projectID as string | undefined

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

  return (
    <>
      {view === 'deployed' ? (
        <AgentList
          agents={projectsWithLogs}
          onSelectAgent={selectAgent}
        />
      ) : view === 'runs' ? (
        <AgentRunsList
          allDeployedAgents={projectsWithLogs}
          initialSelectedAgentID={selectedAgentInstanceID}
        />
      ) : view === 'logs' ? (
        <AgentRunsList
          allDeployedAgents={projectsWithDeployments}
          initialSelectedAgentID={selectedAgentInstanceID}
        />
      ) : (
        <span>404</span>
      )}
    </>
  )
}

export default DashboardHome