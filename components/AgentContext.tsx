import {
  useState,
} from 'react'
import clsx from 'clsx'
import {
  SystemContext,
  UserContext,
  AssistantContext,
} from 'utils/agentLogs'

export interface Props {
  context: (SystemContext | UserContext | AssistantContext)[]
  onSelected: (ctx: SystemContext | UserContext | AssistantContext) => void
}

function AgentContext({
  context,
  onSelected: onOpened,
}: Props) {
  const [opened, setOpened] = useState<number>()

  function open(idx: number) {
    setOpened(idx)
    onOpened(context[idx])
  }

  function close(idx: number) {
    setOpened(undefined)
  }

  function toggle(idx: number) {
    if (opened === idx) {
      close(idx)
    } else {
      open(idx)
    }
  }

  return (
    <div className="flex-1 flex flex-col space-y-2 max-w-full w-full overflow-hidden">
      <h2 className="font-medium text-sm text-gray-500">Logs</h2>

      <div className="flex-1 flex flex-col space-y-1 max-w-full w-full overflow-auto">
        {context.map((ctx, idx) => (
          <>
            <div key={idx} className="flex items-center space-x-2 ">
              <span className="font-bold text-sm text-[#55618C] capitalize min-w-[72px]">{ctx.role}</span>
              <span
                className={clsx(
                  'text-sm text-gray-100 max-w-full truncate p-2 hover:bg-[#1F2437] transition-all rounded-md cursor-pointer w-full',
                  opened === idx && 'bg-[#1F2437]',
                )}
                onClick={() => toggle(idx)}
              >
                {ctx.content}
              </span>
            </div>
            {idx !== context.length - 1 && (
              <div className="ml-1 rounded min-h-[20px] w-px bg-gray-800" />
            )}
          </>
        ))}
      </div>
    </div>
  )
}

export default AgentContext