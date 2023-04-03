import { useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

import { Log, LogType, ToolName, } from 'db/types'
import { notEmpty } from 'utils/notEmpty'

import LogEntry from './LogEntry'
import Text from 'components/Text'

export interface Props {
  logs?: Log[]
  rawLogs?: string | null
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
  isDeployRequestRunning?: boolean
}

function LogStream({
  logs,
  rawLogs,
  onAnswer,
  isDeployRequestRunning,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(function scrollLogs() {
    if (!ref.current) return
    if (!isDeployRequestRunning) return

    ref.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs, isDeployRequestRunning])

  useEffect(function scrollLogs() {
    if (!ref.current) return
    if (isDeployRequestRunning) return

    ref.current.scrollIntoView({ behavior: 'auto' })
  }, [logs, isDeployRequestRunning])

  const trimmedLogs = useMemo(() => {
    return logs
      ?.map(l => {
        switch (l.type) {
          case LogType.Thought:
            const content = l.content
              .replaceAll('\nAction:', '')
              .replaceAll('Action:', '')
              .replaceAll('Thought:', '')
              .trim()
            return content
              ? {
                ...l,
                content,
              }
              : undefined
          default:
            return l
        }
      })
      .filter(notEmpty)
  }, [logs])

  return (
    <div
      className="
        flex-1
        overflow-auto
        text-xs
        tracking-wide
        font-sans
        scroller
        whitespace-pre-wrap
        py-4
        flex
        flex-col
        bg-slate-50
        space-y-4
        px-2
    ">
      {rawLogs &&
        <ReactMarkdown>
          {rawLogs}
        </ReactMarkdown>
      }
      {trimmedLogs && trimmedLogs.map((l, i) =>
        <div
          key={i}
          className="flex flex-col space-y-1"
        >
          <Text
            size={Text.size.S3}
            className="text-slate-400"
            text={`Step ${i + 1}`}
          />
          <LogEntry
            onAnswer={onAnswer}
            log={l}
          />
        </div>
      )}
      <div ref={ref} />
    </div>
  )
}

export default LogStream
