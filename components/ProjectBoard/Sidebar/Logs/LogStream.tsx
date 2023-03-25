import { Fragment, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

import { Log, } from 'db/types'

import ConnectionLine from './ConnectionLine'
import LogEntry from './LogEntry'

export interface Props {
  logs?: Log[]
  rawLogs?: string | null
  onAnswer?: (logID: string, answer: string) => void
}

function LogStream({ logs, rawLogs, onAnswer }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(function scrollLogs() {
    if (!ref.current) return
    ref.current.scrollIntoView({ behavior: 'smooth' })
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
        px-2
    ">
      {rawLogs &&
        <ReactMarkdown>
          {rawLogs}
        </ReactMarkdown>
      }
      {logs && logs.map((l, i, a) =>
        <Fragment key={i}>
          <LogEntry
            onAnswer={onAnswer}
            log={l}
          />
          {i < a.length - 1 &&
            <div className="flex items-center flex-col">
              <ConnectionLine className="h-4" />
            </div>
          }
        </Fragment>
      )}
      <div ref={ref} />
    </div>
  )
}

export default LogStream
