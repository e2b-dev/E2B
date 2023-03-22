import { Log, LogType } from 'db/types'

import Thought from './Thought'
import Tool from './Tool'

export interface Props {
  log: Log
  onAnswer?: (logID: string, answer: string) => void
}

function LogEntry({ log, onAnswer }: Props) {
  return (
    <div className="
      rounded-lg
      p-3
      border
    ">
      {log.type === 'thought' &&
        <Thought
          log={log}
        />
      }
      {log.type === LogType.Tool &&
        <Tool
          log={log}
          onAnswer={onAnswer}
        />
      }
    </div>
  )
}

export default LogEntry
