import {
  useState,
} from 'react'
import { useRouter } from 'next/router'

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
    <div className="flex space-x-2 items-start justify-start max-w-full">
      {logFile.filename.includes('full_message_history') || logFile.filename.includes('current_context') ? (
        <>
          <AgentPromptLogsList
            logs={(logFile.content as AgentPromptLogs).logs}
            onSelected={setSelectedLog}
          />
          <AgentPrompLogDetail
            log={selectedLog}
          />
        </>
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