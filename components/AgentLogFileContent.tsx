import {
  useState,
} from 'react'
import Splitter from '@devbookhq/splitter'
import clsx from 'clsx'

import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
  AgentPromptLogs,
  AgentNextActionLog,
  LiteLogFile,
} from 'utils/agentLogs'
import AgentPrompLogDetail from 'components/AgentPromptLogDetail'
import AgentPromptLogsList from 'components/AgentPromptLogsList'
import AgentNextActionLogDetail from 'components/AgentNextActionLogDetail'

export interface Props {
  logFile?: LiteLogFile
}

function AgentLogFileContent({
  logFile,
}: Props) {
  const [selectedLog, setSelectedLog] = useState<SystemPromptLog | UserPromptLog | AssistantPromptLog>()
  if (!logFile) return null

  return (
    <div className="flex-1 flex space-x-2 items-start justify-start max-w-full">
      {logFile.filename.includes('full_message_history') || logFile.filename.includes('current_context') ? (
        <Splitter
          gutterClassName={clsx(
            'bg-gray-900 hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] px-0.5 rounded-sm group',
          )}
          draggerClassName={clsx(
            'bg-gray-700 group-hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] w-0.5 h-full',
          )}
          classes={['flex pr-2 overflow-auto', 'bg-gray-900 flex pl-2']}
        >
          <AgentPromptLogsList
            logs={(logFile.content as AgentPromptLogs).logs}
            onSelected={setSelectedLog}
          />
          <AgentPrompLogDetail
            log={selectedLog}
          />
        </Splitter>
      ) : logFile.filename.includes('next_action') ? (
        <AgentNextActionLogDetail
          log={logFile.content as AgentNextActionLog}
        />
      ) : logFile.filename.includes('user_input') ? (
        <div className="overflow-auto p-2 h-full bg-[#1F2437] rounded-md flex flex-col space-y-4 w-full border border-gray-800">
          <div className="flex flex-col space-y-1 w-full">
            <span className="text-sm font-medium text-gray-500">User Input</span>
            <span
              className="text-sm text-gray-200 w-full prose whitespace-pre-wrap max-w-full"
            >
              {logFile.content as string}
            </span>
          </div>
        </div>
      ) : (
        <div>
          Unexpected JSON format. Please reach out to the e2b team.
        </div>
      )}
    </div>
  )
}

export default AgentLogFileContent