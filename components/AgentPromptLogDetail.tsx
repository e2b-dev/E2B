import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
} from 'utils/agentLogs'
import dynamic from 'next/dynamic'
const ReactJson = dynamic(import('react-json-view'), { ssr: false })

export interface Props {
  log?: SystemPromptLog | UserPromptLog | AssistantPromptLog
}

function AgentPrompLogDetail({
  log,
}: Props) {
  return (
    <div className="overflow-auto p-2 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 w-full border border-gray-800">
      {log && (
        <>
          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">Role</span>
            <span className="text-sm text-gray-200 w-full">{log.role}</span>
          </div>

          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">Content</span>
            {log.role !== 'assistant' ? (
              <p className="text-sm text-gray-200 w-full prose whitespace-pre-wrap max-w-full">{log.content}</p>
            ) : (
              <ReactJson
                src={JSON.parse(log.content)}
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
            )}
          </div>

          {log.role === 'assistant' && log.function_call && (
            <>
              <span className="text-sm font-medium text-gray-500">Function Call</span>
              <ReactJson
                src={{
                  ...(log as any).function_call,
                  'arguments': JSON.parse(log.function_call.arguments),
                }}
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
            </>
          )}
        </>
      )}
    </div >
  )
}

export default AgentPrompLogDetail