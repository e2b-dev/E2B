import { AgentNextActionLog } from 'utils/agentLogs'
import dynamic from 'next/dynamic'
const ReactJson = dynamic(import('react-json-view'), { ssr: false })

export interface Props {
  log: AgentNextActionLog
}

function AgentNextActionLogDetail({
  log,
}: Props) {
  return (
    <div className="overflow-auto p-2 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 w-full border border-gray-800">
      <div className="flex flex-col space-y-1 w-full">
        <span className="text-sm font-medium text-gray-500">Thoughts</span>
        <ReactJson
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
        <ReactJson
          src={log.command}
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
    </div>
  )
}

export default AgentNextActionLogDetail