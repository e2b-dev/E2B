import {
  useCallback,
  useMemo,
} from 'react'
import Splitter from '@devbookhq/splitter'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { GithubIcon } from 'lucide-react'

import { DeploymentAuthData } from 'pages/api/agent'
import {
  LiteDeploymentLog,
} from 'utils/agentLogs'
import { useLocalStorage } from 'hooks/useLocalStorage'
import useDeploymentRunLog from 'hooks/useDeploymentRunLog'

import AgentRunLogDetail from './AgentRunLogDetail'
import AgentDeploymentStepsList from './AgentDeploymentsStepsList'
import Spinner from './Spinner'

export interface Props {
  log: LiteDeploymentLog
}

function AgentRunLogContent({
  log: initialLog,
}: Props) {
  const [splitterSizes, setSplitterSizes] = useLocalStorage('log-content-splitter', [40, 60])
  const router = useRouter()
  const selectedStepID = router.query.stepID as string

  const slug = router.query.slug as string

  const setSizes = useCallback((pairIdx: number, sizes: number[]) => {
    setSplitterSizes(sizes)
  }, [setSplitterSizes])

  const log = useDeploymentRunLog(initialLog)
  const selectedStep = useMemo(() => {
    return log.content?.find((c: any) => c.id === selectedStepID)
  }, [log.content, selectedStepID])

  const runSteps = log.content && log.content.filter((c: any) => c.type === 'Run')
  const isRunOlderThanTimeout = useMemo(() => {
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000))
    return initialLog.created_at < oneHourAgo
  }, [initialLog.created_at])
  const isRunning = initialLog.deployments.enabled && !isRunOlderThanTimeout && runSteps.length === 1
  const pr = useMemo(() => {
    const gh = (log.deployments.auth as unknown as DeploymentAuthData).github
    return {
      url: `https://github.com/${gh.owner}/${gh.repo}/pull/${gh.pr_number}`,
      repository: `${gh.owner}/${gh.repo}`,
      prNumber: gh.pr_number,
    }
  }, [log.deployments.auth])

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
        <div className="flex space-x-4">
          {log.deployments.secrets &&
            <span className="text-xs text-gray-500">
              Open AI API - using your own API key
            </span>
          }
          {!log.deployments.secrets &&
            <span className="text-xs text-gray-500">
              {'Open AI API - using e2b\'s API key'}
            </span>
          }
          <Link
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 text-sm text-gray-400 hover:text-white transition-all"
          >
            <GithubIcon size="16px" />
            <span>
              {pr.repository}
            </span>
          </Link>
        </div>
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
          <AgentDeploymentStepsList
            steps={log.content as any}
          />
          <AgentRunLogDetail
            step={selectedStep}
          />
        </Splitter>
      </div>
    </main>
  )
}

export default AgentRunLogContent
