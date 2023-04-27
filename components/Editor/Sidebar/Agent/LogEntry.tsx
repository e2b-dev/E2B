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
      p-3
      border-l-4
      rounded
      shadow-sm
      border-y-transparent
      border-r-transparent
      border
      bg-white
      ${log.type === LogType.Tool ? 'border-green-300' : 'border-blue-300'}
    `}>
      {log.type === 'thought' && log.content.trim() &&
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
