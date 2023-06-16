import {
  SystemContext,
  UserContext,
  AssistantContext,
} from 'utils/agentLogs'
import dynamic from 'next/dynamic'
const ReactJson = dynamic(import('react-json-view'), { ssr: false })

export interface Props {
  context?: SystemContext | UserContext | AssistantContext
}

function AgentContextDetail({
  context,
}: Props) {
  return (
    <div className="overflow-auto p-2 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 max-w-[500px] min-w-[500px] border border-gray-800">
      <h2 className="font-medium text-sm text-gray-500">Context</h2>

      {context && (
        <>
          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">Role</span>
            <span className="text-sm text-gray-200 w-full">{context.role}</span>
          </div>

          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">Content</span>
            {(context as any).role !== 'assistant' ? (
              <p className="text-sm text-gray-200 w-full prose whitespace-pre-wrap max-w-full">{context.content}</p>
            ) : (
              <ReactJson
                src={JSON.parse(context.content)}
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

          {(context as any).role === 'assistant' && (
            <>
              <span className="text-sm font-medium text-gray-500">Function Call</span>
              <ReactJson
                src={{
                  ...(context as any).function_call,
                  'arguments': JSON.parse((context as any).function_call.arguments),
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
      )
      }

    </div >
  )
}

export default AgentContextDetail