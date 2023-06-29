import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import Splitter from '@devbookhq/splitter'
import clsx from 'clsx'
import { useRouter } from 'next/router'

import {
  LiteDeploymentLog,
} from 'utils/agentLogs'
import { useLocalStorage } from 'hooks/useLocalStorage'
import useDeploymentRunLog from 'hooks/useDeploymentRunLog'
import AgentRunLogDetail from './AgentRunLogDetail'
import AgentDeploymentLogsList from './AgentDeploymentsLogsList'
import Spinner from './Spinner'

export interface Props {
  log: LiteDeploymentLog
}

function AgentRunLogContent({
  log: initialLog,
}: Props) {
  const [selectedLog, setSelectedLog] = useState<any>()
  const [splitterSizes, setSplitterSizes] = useLocalStorage('log-content-splitter', [40, 60])
  const router = useRouter()

  const slug = router.query.slug as string

  const setSizes = useCallback((pairIdx: number, sizes: number[]) => {
    setSplitterSizes(sizes)
  }, [setSplitterSizes])

  const log = useDeploymentRunLog(initialLog)

  const runSteps = log.content && log.content.filter((c: any) => c.type === 'Run')
  const isRunOlderThanTimeout = useMemo(() => {
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000))
    return initialLog.created_at < oneHourAgo
  }, [initialLog.created_at])
  const isRunning = initialLog.deployments.enabled && !isRunOlderThanTimeout && runSteps.length > 0 && runSteps.length <= 2

  return (
    <main className="overflow-hidden flex flex-col max-h-full flex-1 rounded-md">
      <header className="flex items-center px-4 py-3 border-b border-b-white/5 justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-semibold text-white">Agent Run Logs</h1>
          {isRunning &&
            <div className="mt-1">
              <Spinner />
            </div>
          }
        </div>
        <div className="text-sm text-gray-400 self-center truncate">{slug}</div>
      </header>
      <div className="flex-1 flex space-x-2 items-start justify-start overflow-hidden my-4">
        <Splitter
          gutterClassName={clsx(
            'bg-gray-900 hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] px-0.5 rounded-sm group',
          )}
          draggerClassName={clsx(
            'bg-gray-700 group-hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] w-0.5 h-full',
          )}
          classes={['pr-2 overflow-auto', 'bg-gray-900 pl-2 pr-1']}
          initialSizes={splitterSizes}
          onResizeFinished={setSizes}
          minWidths={[120, 120]}
        >
          <AgentDeploymentLogsList
            logs={log.content as any}
            onSelected={setSelectedLog}
          />
          <AgentRunLogDetail
            log={selectedLog}
          />
        </Splitter>
      </div>
    </main>
  )
}

export default AgentRunLogContent
