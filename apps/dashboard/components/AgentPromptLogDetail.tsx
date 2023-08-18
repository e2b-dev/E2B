import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
} from 'utils/agentLogs'
import { useMemo } from 'react'
import JsonView from 'components/JsonView'


function handleJSONQuotes(content: string) {
  try {
    return JSON.parse(content)
  } catch (err) {
    // Don't log anything here, try parsing with quotes replaced
  }

  try {
    return JSON.parse(content.replace(/"/g, '\\"').replace(/'/g, '"'))
  } catch (err) {
    // Don't log anything here, return undefined
  }
}

export interface Props {
  log?: SystemPromptLog | UserPromptLog | AssistantPromptLog
}

function AgentPrompLogDetail({
  log,
}: Props) {
  const parsedLog = useMemo(() => {
    return log ? handleJSONQuotes(log.content) : undefined
  }, [log])

  return (
    <div className="overflow-auto mr-2.5 mb-2.5 p-2 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 border border-[#6366F1]/50">
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
              <>
                {!parsedLog &&
                  <div>
                    Unexpected JSON format. Please reach out to the e2b team.
                  </div>
                }
                {parsedLog &&
                  <JsonView
                    src={parsedLog}
                    name={null}
                    style={{
                      background: 'transparent',
                      display: 'flex',
                    }}
                    displayObjectSize={false}
                    quotesOnKeys={false}
                    sortKeys={true}
                    displayDataTypes={false}
                    theme="ocean"
                    enableClipboard={false}
                  />
                }
              </>
            )}
          </div>

          {log.role === 'assistant' && log.function_call && (
            <>
              <span className="text-sm font-medium text-gray-500">Function Call</span>
              <JsonView
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