import {
  useMemo,
  useState,
} from 'react'
import {
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

import {
  LiteDeployment,
} from 'utils/agentLogs'

import UploadTree from './UploadFiletree'

export interface Props {
  deployments: LiteDeployment[]
}

function AgentDeploymentLogList({
  deployments,
}: Props) {
  const [openDeployments, setOpenDeployments] = useState<{ [key: string]: boolean }>({})
  const sortedDeployments = useMemo(() => deployments
    // deployments sorted by created_at - the newest first
    .sort((a, b) => {
      if (a.created_at > b.created_at) return -1
      if (a.created_at < b.created_at) return 1
      return 0
    })
    // Sort the log_files inside logUploads alphabtetical by relativePath
    .map(d => {
      const sortedLogs = d.log_files.sort((a, b) => {
        if (a.relativePath > b.relativePath) return 1
        if (a.relativePath < b.relativePath) return -1
        return 0
      })

      return {
        ...d,
        log_files: sortedLogs,
      }
    }), [deployments])

  function toggleDeployments(logUploadID: string) {
    if (openDeployments[logUploadID]) {
      setOpenDeployments(prev => ({
        ...prev,
        [logUploadID]: false,
      }))
    } else {
      setOpenDeployments(prev => ({
        ...prev,
        [logUploadID]: true,
      }))
    }
  }

  return (
    <main className="overflow-hidden flex flex-col max-h-full flex-1">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8 min-h-[88px]">
        <h1 className="text-2xl font-semibold text-white">Agent Deployments</h1>
      </header>
      {sortedDeployments.length === 0 && (
        <div
          className="flex items-center justify-center flex-1"
        >
          <p className="text-gray-400 text-lg">No log files uploaded yet</p>
        </div>
      )}

      {sortedDeployments.length > 0 && (
        <div className="flex-col space-y-4 py-2 sm:px-4 lg:px-8 flex-1 flex pr-2 overflow-auto">
          {sortedDeployments.map(deployment => (
            <div
              key={deployment.id}
            >
              <div
                className="flex flex-col space-y-2 flex-1"
              >
                <div className="flex items-center space-x-2">
                  <button
                    className={clsx(
                      'h-6 w-6 flex items-center justify-center px-1 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                      openDeployments[deployment.id] && 'bg-gray-700',
                      !openDeployments[deployment.id] && 'bg-gray-800',
                    )}
                    onClick={() => toggleDeployments(deployment.id)}
                  >
                    <ChevronRight size={14} className={clsx(
                      'text-gray-400',
                      'transition-all',
                      'select-none',
                      openDeployments[deployment.id] && 'rotate-90',
                    )} />
                  </button>
                  <span
                    className={clsx(
                      'text-sm',
                      'font-semibold',
                      'text-gray-200',
                      'whitespace-nowrap',
                    )}
                    // This prevents hydration warning for timestamps rendered via SSR
                    suppressHydrationWarning
                  >
                    {deployment.enabled}
                    <span>
                      {deployment.projects.name}
                    </span>
                  </span>
                </div>

                {openDeployments[deployment.id] && (
                  <div className="flex flex-col space-y-3 border-l border-gray-800 pl-2 ml-[11px] flex-1">
                    <UploadTree
                      log={deployment}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main >
  )
}

export default AgentDeploymentLogList
