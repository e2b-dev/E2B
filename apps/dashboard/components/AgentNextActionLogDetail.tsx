import { AgentNextActionLog } from 'utils/agentLogs'

import JsonView from 'components/JsonView'
export interface Props {
  log: AgentNextActionLog
}

function AgentNextActionLogDetail({
  log,
}: Props) {
  return (
    <div className="overflow-auto p-2 mr-2.5 mb-2.5 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 w-full border border-[#6366F1]/50">
      <div className="flex flex-col space-y-1 w-full">
        <span className="text-sm font-medium text-gray-500">Thoughts</span>
        <JsonView
          src={log.thoughts}
          name={null}
          style={{
            background: 'transparent'
          }}
          displayObjectSize={false}
          quotesOnKeys={false}
          sortKeys={true}
          displayDataTypes={false}
          theme="ocean"
          enableClipboard={false}
        />
      </div>
      <div className="flex flex-col space-y-1 w-full">
        <span className="text-sm font-medium text-gray-500">Command</span>
        <JsonView
          src={log.command}
          name={null}
          style={{
            background: 'transparent',
          }}
          displayObjectSize={false}
          quotesOnKeys={false}
          sortKeys={true}
          displayDataTypes={false}
          theme="ocean"
          enableClipboard={false}
        />
      </div>
    </div>
  )
}

export default AgentNextActionLogDetail