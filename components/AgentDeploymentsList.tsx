import {
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Plus,
} from 'lucide-react'
import clsx from 'clsx'
import { usePostHog } from 'posthog-js/react'

import {
  LiteDeployment,
} from 'utils/agentLogs'

import DeploymentTree from 'components/DeploymentTree'

export interface Props {
  deployments: LiteDeployment[]
}

function AgentDeploymentsList({
  deployments,
}: Props) {
  const [openDeployments, setOpenDeployments] = useState<{ [key: string]: boolean }>({})
  const posthog = usePostHog()
  const sortedDeployments = useMemo(() => deployments
    // deployments sorted by created_at - the newest first
    .sort((a, b) => {
      if (a.created_at > b.created_at) return -1
      if (a.created_at < b.created_at) return 1
      return 0
    }), [deployments])

  function toggleDeployments(deploymentID: string) {
    if (openDeployments[deploymentID]) {
      posthog?.capture('closed deployment', {
        deploymentID: deploymentID,
      })
      setOpenDeployments(prev => ({
        ...prev,
        [deploymentID]: false,
      }))
    } else {
      posthog?.capture('opened deployment', {
        deploymentID: deploymentID,
      })
      setOpenDeployments(prev => ({
        ...prev,
        [deploymentID]: true,
      }))
    }
  }

  function captureSDKLinkClick() {
    posthog?.capture('clicked SDK coming soon link')
    console.log('clicked')
  }

  return (
    <main className="overflow-hidden flex flex-col max-h-full flex-1 rounded-md">
      <header className="flex items-center justify-between px-4 py-3 border-b border-b-white/5">
        <h1 className="text-xl font-semibold text-white">Agent Deployments</h1>
        <div className="flex items-center space-x-4">
          <a
            className="text-sm font-medium text-indigo-400 hover:text-indigo-500 cursor-pointer transition-all"
            href="https://github.com/e2b-dev/sdk"
            target="_blank"
            rel="noreferrer noopener"
            onClick={captureSDKLinkClick}
          >
            SDK Coming Soon
          </a>

          <Link href="/agent/smol-developer">
            <button
              className="py-1 px-2 rounded-md bg-green-400/10 hover:bg-green-400/20 border border-green-400/20 transition-all flex items-center space-x-2 text-green-400 text-sm font-semibold"
            >
              <Plus size={16} />
              <span>Deploy Smol Developer</span>
            </button>
          </Link>
        </div>
      </header>
      {sortedDeployments.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-400 text-lg">No log files uploaded yet</p>
        </div>
      )}

      {sortedDeployments.length > 0 && (
        <div className="my-4 flex-col space-y-4 px-4 py-2 sm:px-4 flex-1 flex pr-2 overflow-auto">
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
                  <div
                    className={clsx(
                      'text-sm',
                      'font-semibold',
                      'text-gray-200',
                      'flex',
                      'space-x-2',
                      'whitespace-nowrap',
                    )}
                    // This prevents hydration warning for timestamps rendered via SSR
                    suppressHydrationWarning
                  >
                    <span className="text-gray-200 font-normal">
                      {deployment.projects.name}
                    </span>
                    <span className="text-gray-600 font-normal truncate">
                      {deployment.projects.slug}
                    </span>
                  </div>
                  {/* {deployment.secrets &&
                    <span className="text-xs text-gray-500">
                      Open AI API - using your own API key
                    </span>
                  }
                  {!deployment.secrets &&
                    <span className="text-xs text-gray-500">
                      {'Open AI API - using e2b\'s API key'}
                    </span>
                  } */}
                </div>

                {openDeployments[deployment.id] && (
                  <div className="flex flex-col transition-all space-y-3 border-l border-white/5 pl-2 ml-[11px] flex-1">
                    <DeploymentTree
                      deployment={deployment}
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

export default AgentDeploymentsList
