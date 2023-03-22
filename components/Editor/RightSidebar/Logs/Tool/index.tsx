import { ToolLog, ToolName } from 'db/types'

import AskHuman from './AskHuman'
import CurlServer from './CurlServer'
import InstallNPMDeps from './InstallNPMDeps'
import RunCode from './RunCode'

export interface Props {
  log: ToolLog
  onAnswer?: (logID: string, answer: string) => void
}

function Tool({
  log,
  onAnswer,
}: Props) {
  switch (log.tool_name) {
    case ToolName.CurlJavaScriptServer:
      return <CurlServer log={log} />
    case ToolName.InstallNPMDependencies:
      return <InstallNPMDeps log={log} />
    case ToolName.RunJavaScriptCode:
      return <RunCode log={log} />
    case ToolName.AskHuman:
      return <AskHuman log={log} onAnswer={onAnswer} />
    default:
      throw new Error(`'${log.tool_name}': Unknown tool log`)
  }
}

export default Tool