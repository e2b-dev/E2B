import {
  Package,
} from 'lucide-react'

import { ToolName, ToolLog } from 'db/types'

import Base from './Base'


export interface Props {
  log: ToolLog
  isRunning?: boolean
}

function InstallNPMDeps({
  log,
  isRunning,
}: Props) {
  if (log.tool_name !== ToolName.InstallNPMDependencies) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.InstallNPMDependencies}' tool`)

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
      icon={<Package size="16px" />}
      body={body}
    />
  )
}

export default InstallNPMDeps
