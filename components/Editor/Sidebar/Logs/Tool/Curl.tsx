import {
  Terminal,
} from 'lucide-react'

import { ToolName, ToolLog } from 'db/types'

import Base from './Base'


export interface Props {
  log: ToolLog
}

function Curl({
  log,
}: Props) {
  if (log.tool_name !== ToolName.Curl) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.Curl}' tool`)

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
      log={log}
      icon={<Terminal size="16px" />}
      body={body}
    />
  )
}

export default Curl
