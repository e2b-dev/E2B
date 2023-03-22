import { ToolLog, ToolName } from 'db/types'

import CurlServer from './CurlServer'
import InstallNPMDeps from './InstallNPMDeps'
import RunCode from './RunCode'

export interface Props {
  log: ToolLog
}

function Tool({
  log
}: Props) {
  switch (log.tool_name) {
    case ToolName.CurlJavaScriptServer:
      return <CurlServer log={log} />
    case ToolName.InstallNPMDependencies:
      return <InstallNPMDeps log={log} />
    case ToolName.RunJavaScriptCode:
      return <RunCode log={log} />
    default:
      throw new Error(`'${log.tool_name}': Unknown tool log`)
  }
}

export default Tool