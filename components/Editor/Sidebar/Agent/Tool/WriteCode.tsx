import {
  FileEdit,
} from 'lucide-react'

import { ToolName, ToolLog } from 'db/types'

import Base from './Base'

export interface Props {
  log: ToolLog
  isRunning?: boolean
}

function WriteCode({
  log,
  isRunning,
}: Props) {
  if (log.tool_name !== ToolName.WriteJavaScriptCode) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.WriteJavaScriptCode}' tool`)

  const body = log.tool_input.trim()
    ? (
      <div className="">
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
      icon={<FileEdit size="16px" />}
      body={body}
    />
  )
}

export default WriteCode
