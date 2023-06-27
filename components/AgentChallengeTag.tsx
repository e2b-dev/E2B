import clsx from 'clsx'
import { AgentChallengeTag as AgentChallengeTagType } from 'utils/agentLogs'

export interface Props {
  tag: AgentChallengeTagType
}

function AgentChallengeTag({
  tag,
}: Props) {
  return (
    <span
      className={clsx(
        'flex items-center justify-center h-6 px-2 rounded-md text-xs border shrink-0',
        tag.severity === 'Success' && 'bg-green-500/10 border-green-500/20 text-green-500',
        tag.severity === 'Warning' && 'bg-orange-500/10 border-orange-500/20 text-orange-500',
        tag.severity === 'Error' && 'bg-red-500/10 border-red-500/20 text-red-500',
      )}
    >
      {tag.text}
    </span>
  )
}

export default AgentChallengeTag