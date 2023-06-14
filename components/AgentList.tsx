import AgentListItem from 'components/AgentListItem'
import Link from 'next/link'

import { projects, deployments } from 'db/prisma'

export interface Props {
  agents: {
    project: projects & {
      deployments: deployments[];
    };
    deployment: deployments;
  }[]
  onSelectAgent: (e: any, projectID: string) => void
}

function AgentList({
  agents,
  onSelectAgent,
}: Props) {
  return (
    <main className="overflow-hidden">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">Deployed Agents</h1>
      </header>

      <ul role="list" className="px-4 sm:px-6 lg:px-8 space-y-4 overflow-auto">
        {agents.map(a => (
          <li
            key={a.project.id}
          >
            <Link
              href={`/?view=runs&projectID=${a.project.id}`}
              onClick={(e) => onSelectAgent(e, a.project.id)}
            >
              <AgentListItem
                agent={a}
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default AgentList