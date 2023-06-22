import {
  useCallback,
  useState,
} from 'react'
import Splitter from '@devbookhq/splitter'
import clsx from 'clsx'

import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
  LiteDeploymentLog,
} from 'utils/agentLogs'
import AgentPrompLogDetail from 'components/AgentPromptLogDetail'
import AgentPromptLogsList from 'components/AgentPromptLogsList'
import { useLocalStorage } from 'hooks/useLocalStorage'

export interface Props {
  log: LiteDeploymentLog
}

function AgentRunLogContent({
  log,
}: Props) {
  const [selectedLog, setSelectedLog] = useState<SystemPromptLog | UserPromptLog | AssistantPromptLog>()
  const [splitterSizes, setSplitterSizes] = useLocalStorage('log-content-splitter', [40, 60])

  const setSizes = useCallback((pairIdx: number, sizes: number[]) => {
    setSplitterSizes(sizes)
  }, [setSplitterSizes])

  return (
    <main className="overflow-hidden flex flex-col max-h-full flex-1 border-white/5 border rounded-md">
      <header className="flex items-center py-4 sm:px-6 lg:px-8 border-b border-b-white/5">
        <h1 className="text-2xl font-semibold text-white">Agent Run Logs</h1>
        <div className="text-base text-gray-400 self-center">Log</div>
      </header>
      <div className="flex-1 flex space-x-2 items-start justify-start overflow-hidden my-4">
        <Splitter
          gutterClassName={clsx(
            'bg-gray-900 hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] px-0.5 rounded-sm group',
          )}
          draggerClassName={clsx(
            'bg-gray-700 group-hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] w-0.5 h-full',
          )}
          classes={['pr-2 overflow-auto', 'bg-gray-900 pl-2']}
          initialSizes={splitterSizes}
          onResizeFinished={setSizes}
          minWidths={[120, 120]}
        >
          <AgentPromptLogsList
            logs={log.content as any}
            onSelected={setSelectedLog}
          />
          <AgentPrompLogDetail
            log={selectedLog}
          />
        </Splitter>
      </div>
    </main>
  )
}

export default AgentRunLogContent
