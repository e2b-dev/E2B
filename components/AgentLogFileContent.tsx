import {
  useState,
} from 'react'
import { useRouter } from 'next/router'
import Splitter from '@devbookhq/splitter'
import clsx from 'clsx'

import { log_files } from 'db/prisma'
import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
  AgentPromptLogs,
  AgentNextActionLog,
} from 'utils/agentLogs'
import AgentPrompLogDetail from 'components/AgentPromptLogDetail'
import AgentPromptLogsList from 'components/AgentPromptLogsList'
import AgentNextActionLogDetail from 'components/AgentNextActionLogDetail'

export interface Props {
  logFile?: Omit<log_files, 'content'> & { content: AgentPromptLogs | AgentNextActionLog }
}

function AgentLogFileContent({
  logFile,
}: Props) {
  const router = useRouter()
  const [selectedLog, setSelectedLog] = useState<SystemPromptLog | UserPromptLog | AssistantPromptLog>()

  // return (
  //   <>
  //     <AgentPromptLogsList
  //       logs={!!logFile ? (logFile.content as AgentPromptLogs)?.logs : []}
  //       onSelected={setSelectedLog}
  //     />
  //     <AgentPrompLogDetail
  //       log={selectedLog}
  //     />
  //   </>
  // )

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
      ) : (
        <div>
          Unexpected JSON format. Please reach out to the e2b team.
        </div>
      )}
    </div>
  )
}

export default AgentLogFileContent