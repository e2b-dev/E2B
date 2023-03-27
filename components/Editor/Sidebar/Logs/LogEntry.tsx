import {
  Log,
  LogType,
  ToolName,
} from 'db/types'

import Thought from './Thought'
import Tool from './Tool'

export interface Props {
  log: Log
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
}

function LogEntry({ log, onAnswer }: Props) {
  return (
    <div className={`
      rounded-lg
      p-3
      border
      ${log.type === LogType.Tool ? 'border-green-300' : 'border-blue-300'}
    `}>
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
