import {
  useState,
  useEffect,
  Fragment,
  useCallback,
} from 'react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import {
  SystemPromptLog,
  UserPromptLog,
  AssistantPromptLog,
} from 'utils/agentLogs'

export interface Props {
  logs: (SystemPromptLog | UserPromptLog | AssistantPromptLog)[]
  onSelected: (ctx: SystemPromptLog | UserPromptLog | AssistantPromptLog) => void
}

function AgentPromptLogsList({
  logs,
  onSelected,
}: Props) {
  const router = useRouter()
  const [openedIdx, setOpenedIdx] = useState<number>()

  const open = useCallback((idx: number) => {
    setOpenedIdx(idx)
    onSelected(logs[idx])
    router.push({
      pathname: `/log/${router.query.logFileID}`,
      query: {
        ...router.query['filename'] && { filename: router.query['filename'] },
        selectedLog: idx.toString(),
      },
    }, undefined, { shallow: true })
  }, [logs, onSelected, router])

  const close = useCallback(() => {
    setOpenedIdx(undefined)
  }, [])

  function toggle(idx: number) {
    if (openedIdx === idx) {
      close()
    } else {
      open(idx)
    }
  }

  useEffect(function selectLogBasedOnURLQuery() {
    const selectedLog = router.query.selectedLog as string
    let idx: number
    if (selectedLog) {
      idx = parseInt(selectedLog)
    } else {
      idx = 0
    }
    setOpenedIdx(idx)
    onSelected(logs[idx])
  }, [router, logs, onSelected])

  useEffect(function listenToArrowNavigitons() {
    function handleUpKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') {
        if (openedIdx === undefined) {
          open(logs.length - 1)
        } else if (openedIdx === 0) {
          close()
        } else {
          open(openedIdx - 1)
        }
      } else if (e.key === 'ArrowDown') {
        if (openedIdx === undefined) {
          open(0)
        } else if (openedIdx === logs.length - 1) {
          close()
        } else {
          open(openedIdx + 1)
        }
      }
    }
    window.addEventListener('keydown', handleUpKey)
    return () => window.removeEventListener('keydown', handleUpKey)
  }, [logs, open, openedIdx, close])

  return (
    <div className="flex-1 flex flex-col space-y-2 max-w-full w-full overflow-hidden">
      <h2 className="font-medium text-sm text-gray-500">Logs</h2>

      <div className="flex-1 flex flex-col space-y-1 max-w-full w-full overflow-auto">
        {logs.map((ctx, idx) => (
          <Fragment key={idx}>
            <div className="flex items-center space-x-2">
              <span className={clsx(
                'font-bold text-sm capitalize min-w-[72px]',
                openedIdx === idx && 'text-[#6366F1]',
                openedIdx !== idx && 'text-[#55618C]',
              )}
              >
                {ctx.role}
              </span>
              <span
                className={clsx(
                  'text-sm text-gray-100 max-w-full truncate p-2 hover:bg-[#1F2437] transition-all rounded-md cursor-pointer w-full',
                  openedIdx === idx && 'bg-[#1F2437]',
                )}
                onClick={() => toggle(idx)}
              >
                {ctx.content}
              </span>
            </div>
            {idx !== logs.length - 1 && (
              <div className="ml-1 rounded min-h-[20px] w-px bg-gray-800" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export default AgentPromptLogsList