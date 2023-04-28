import {
  Code2,
} from 'lucide-react'

import { ToolName, ToolLog } from 'db/types'

import Base from './Base'


export interface Props {
  log: ToolLog
  isRunning?: boolean
}

function RunSavedCode({
  log,
  isRunning,
}: Props) {
  if (log.tool_name !== ToolName.RunSavedCode) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.WriteJavaScriptCode}' tool`)

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
      icon={<Code2 size="16px" />}
      body={body}
    />
  )
}

export default RunSavedCode
