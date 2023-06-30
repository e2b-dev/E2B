import {
  File,
} from 'lucide-react'

import { ToolLog } from 'db/types'

import Base from './Base'


export interface Props {
  log: ToolLog
  isRunning?: boolean
}

function ReadFile({
  log,
  isRunning,
}: Props) {
  const body = log.tool_input.trim()
    ? (
      <div className="
        pt-2
        ">
        <pre>
          {log.tool_input.trim()}
        </pre>
      </div>
    )
    : null


  return (
    <Base
      isRunning={isRunning}
      log={log}
      icon={<File size="16px" />}
      body={body}
    />
  )
}

export default ReadFile
