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
  const [selectedLogIdx, setSelectedLogIdx] = useState<number>(0)

  const selectLog = useCallback((idx: number) => {
    setSelectedLogIdx(idx)
    onSelected(logs[idx])
    router.replace({
      pathname: `/log/${router.query.logFileID}`,
      query: {
        ...router.query['filename'] && { filename: router.query['filename'] },
        selectedLog: idx.toString(),
      },
    }, undefined, { shallow: true })
  }, [logs, onSelected, router])

  useEffect(function selectLogBasedOnURLQuery() {
    const selectedLog = router.query.selectedLog as string
    let idx: number
    if (selectedLog) {
      idx = parseInt(selectedLog)
    } else {
      idx = 0
    }
    setSelectedLogIdx(idx)
    onSelected(logs[idx])
  }, [router, logs, onSelected])

  useEffect(function listenToArrowNavigitons() {
    function handleUpKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') {
        if (selectedLogIdx === 0) {
          selectLog(logs.length - 1)
        } else {
          selectLog(selectedLogIdx - 1)
        }
      } else if (e.key === 'ArrowDown') {
        if (selectedLogIdx === logs.length - 1) {
          selectLog(0)
        } else {
          selectLog(selectedLogIdx + 1)
        }
      }
    }
    window.addEventListener('keydown', handleUpKey)
    return () => window.removeEventListener('keydown', handleUpKey)
  }, [logs, selectLog, selectedLogIdx])

  return (
    <div className="flex-1 flex flex-col space-y-2 max-w-full w-full overflow-hidden">
      <h2 className="font-medium text-sm text-gray-500">Logs</h2>

      {logs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">No logs</p>
        </div>
      )}

      <div className="flex-1 flex flex-col space-y-1 max-w-full w-full overflow-auto">
        {logs.map((ctx, idx) => (
          <Fragment key={idx}>
            <div className="flex items-center space-x-2">
              <span className={clsx(
                'font-bold text-sm capitalize min-w-[72px]',
                selectedLogIdx === idx && 'text-[#6366F1]',
                selectedLogIdx !== idx && 'text-[#55618C]',
              )}
              >
                {ctx.role}
              </span>
              <span
                className={clsx(
                  'text-sm text-gray-100 max-w-full truncate p-2 hover:bg-[#1F2437] transition-all rounded-md cursor-pointer w-full',
                  selectedLogIdx === idx && 'bg-[#1F2437]',
                )}
                onClick={() => selectLog(idx)}
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