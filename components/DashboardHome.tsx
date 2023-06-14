import {
  useState,
} from 'react'
import {
  Zap,
  ListEnd,
  Menu,
} from 'lucide-react'
import { useRouter } from 'next/router'
import { usePostHog } from 'posthog-js/react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import { deployments, projects } from 'db/prisma'
import AgentList from 'components/AgentList'
import AgentRunsList from 'components/AgentRunsList'
import DashboardDesktopSidebar from 'components/Sidebar/DashboardDesktopSidebar'
import DashboardMobileSidebar from 'components/Sidebar/DashboardMobileSidebar'
import FeedbackButton from 'components/FeedbackButton'

const navigation = [
  {
    name: 'Deployed Agents',
    view: 'deployed',
    icon: Zap,
  },
  {
    name: 'Agent Runs',
    view: 'runs',
    icon: ListEnd,
  },
]

export interface Props {
  projects: (projects & { deployments: deployments[] })[]
}

function DashboardHome({
  projects,
}: Props) {
  const supabaseClient = useSupabaseClient()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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
    <div className="overflow-hidden">
      <DashboardMobileSidebar
        isSidebarOpen={isSidebarOpen}
        onSetSidebarOpen={setIsSidebarOpen}
        onSignOut={signOut}
        navigation={navigation}
      />

      <DashboardDesktopSidebar
        onSignOut={signOut}
        navigation={navigation}
      />

      <div className="xl:pl-72 flex flex-col max-h-full">
        {/* Mobile menu icon */}
        <div className="xl:hidden sticky top-0 z-40 flex justify-between h-16 shrink-0 items-center gap-x-6 border-b border-white/5 bg-gray-900 px-4 shadow-sm sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-white xl:hidden" onClick={() => setIsSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Menu aria-hidden="true" />
          </button>

          <div className="xl:hidden">
            <FeedbackButton
              onClick={() => { console.log('todo') }}
            />
          </div>
        </div>

        <div className="hidden xl:flex py-2 px-6 border-b border-white/5">
          <FeedbackButton
            onClick={() => { console.log('todo') }}
          />
        </div>

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
        ) : (
          <span>404</span>
        )}
      </div>
    </div >
  )
}

export default DashboardHome