import {
  useState,
} from 'react'
import {
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import Link from 'next/link'

import { deployments, projects } from 'db/prisma'


export interface Props {
  allDeployedAgents: {
    project: projects & { deployments: deployments[] }
    deployment: deployments
  }[]
  initialSelectedAgentID?: string
  // agentInstance: {
  //   project: projects & { deployments: deployments[] }
  //   deployment: deployments
  // }
}

function AgentRunsList({
  allDeployedAgents,
  initialSelectedAgentID,
}: Props) {
  const router = useRouter()
  const [selectedAgentID, setSelectedAgentID] = useState(initialSelectedAgentID || '')
  const agentInstance = allDeployedAgents.find(a => a.project.id === selectedAgentID)
  const runs = agentInstance?.deployment.logs.reduce((acc: any, l: any) => {
    const runID = l['properties']['run_id']
    if (!acc[runID]) {
      acc[runID] = []
    } else {
      acc[runID].push(l)
    }
    return acc
  }, {})
  // function getAgentRuns(agentInstance: any) {
  // }






  // agentInstance={projectsWithDeployments.find(p => p.project.id === selectedAgentInstanceID)!}

  // TODO: If no agent instance was specified, display all instances and runs and make them foldabble.

  // console.log('agentInstance', agentInstance)
  // // TODO: We'll have a better concept for run, challenge, task, benchmark, etc
  // // once we give SDK to the first users. Let's start with a simple version first.
  // // At the moment, a run is just an array of logs with the same run ID.
  // const runs = agentInstance.deployment.logs.reduce((acc: any, l: any) => {
  //   const runID = l['properties']['run_id']
  //   console.log('run ID', runID)
  //   console.log('log', l)
  //   console.log('acc', acc)
  //   if (!acc[runID]) {
  //     acc[runID] = []
  //   } else {
  //     acc[runID].push(l)
  //   }
  //   return acc
  // }, {})

  function toggleSelectedAgentID(projectID: string) {
    if (selectedAgentID === projectID) {
      setSelectedAgentID('')
      router.push('/?view=runs', undefined, { shallow: true })
    } else {
      setSelectedAgentID(projectID)
      router.push(`/?view=runs&projectID=${projectID}`, undefined, { shallow: true })
    }
  }


  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">Agent Runs</h1>
      </header>


      <div className="flex flex-col space-y-4">
        {/* Each deployed agent */}
        {allDeployedAgents.map((a) => (
          <div key={a.project.id} className="flex flex-col space-y-2">
            <div className="group flex items-center space-x-2 px-4 sm:px-6 lg:px-8">
              <div
                className={clsx(
                  'p-1 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                  selectedAgentID === a.project.id && 'bg-gray-700',
                  selectedAgentID !== a.project.id && 'bg-gray-800',
                )}
                onClick={() => toggleSelectedAgentID(a.project.id)}
              >
                <ChevronRight size={15} className={clsx(
                  'text-gray-400',
                  'transition-all',
                  'select-none',
                  selectedAgentID === a.project.id && 'rotate-90',
                )} />
              </div>
              <span
                className={clsx(
                  'text-sm group-hover:font-semibold',
                  selectedAgentID === a.project.id && 'font-semibold',
                )}
              >
                {a.project.name} - {a.project.id} [TODO: Better name]
              </span>
            </div>

            {/* Each run */}
            {selectedAgentID === a.project.id && (
              <div className="px-[43px] flex items-start space-x-5 w-full">
                <div className="w-px self-stretch border-r border-gray-800 rounded" />
                <div className="flex flex-col space-y-3 w-full">
                  {Object.keys(runs).map((runID: string) => (
                    <Link
                      key={runID}
                      href={`/deployed/${a.project.id}/run/${runID}`}
                    >
                      <div className="px-4 py-2 cursor-pointer text-sm bg-[#1F2437] hover:bg-[#262C40] border border-[#2A3441] rounded-md">
                        <span>runID: {runID} [TODO: Better name]</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main >
  )
}

export default AgentRunsList