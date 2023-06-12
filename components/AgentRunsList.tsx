import { deployments, projects } from 'db/prisma'


export interface Props {
  agentInstance: (projects & { deployments: deployments[] })
}

function AgentRunsList({
  agentInstance,
}: Props) {
  console.log('agentInstance', agentInstance)
  // TODO: We'll have a better concept for run, challenge, task, benchmark, etc
  // once we give access to the AutoGPT team. Let's start with a simple version first.
  // At the moment, a run is just an array of logs with the same run ID.
  const runs = agentInstance.deployments.reduce((acc, d) => {

    return acc
  }, [])


  return (
    <main className="overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/5 p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">{agentInstance.name}</h1>
      </header>

      <ul role="list" className="px-4 sm:px-6 lg:px-8 space-y-4 overflow-auto">

      </ul>
    </main>
  )
}

export default AgentRunsList