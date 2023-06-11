import { projects, deployments } from 'db/prisma'

export interface Props {
  agent: {
    project: projects & {
      deployments: deployments[];
    };
    deployment: deployments;
  }
}


function AgentListItem({
  agent,
}: Props) {
  return (
    <div className="flex flex-col space-y-4 transition-all cursor-pointer px-4 py-2 w-full bg-[#1F2437] hover:bg-[#262C40] border border-[#2A3441] rounded-md">
      <span className="text-sm font-medium">{agent.project.id} [TODO: Better name]</span>
      <span className="text-sm text-white/40">Agent: {agent.project.name}</span>
    </div>
  )
}

export default AgentListItem