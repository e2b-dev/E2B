import {
  ReactNode
} from 'react'
import {
  HelpCircle,
} from 'lucide-react'

import { ToolName, ToolLog } from 'db/types'

import Base from './Base'

export interface Props {
  log: ToolLog
}

function AskHuman({
  log,
}: Props) {
  if (log.tool_name !== ToolName.AskHuman) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.AskHuman}' tool`)

  let body: ReactNode = null
  if (log.tool_input.trim()) {
    body = (
      <div className="
        pt-2
      ">
        TODO
      </div>
    )
  }

  return (
    <Base
      log={log}
      icon={<HelpCircle size="16px" />}
      body={body}
    />
  )
}

export default AskHuman