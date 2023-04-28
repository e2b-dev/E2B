import { ToolLog, ToolName } from 'db/types'

import AskHuman from './AskHuman'
import Curl from './Curl'
import InstallNPMDeps from './InstallNPMDeps'
import WriteCode from './WriteCode'
import RunSavedCode from './RunSavedCode'
import LetHumanChoose from './LetHumanChoose'

export interface Props {
  log: ToolLog
  isRunning?: boolean
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
}

function Tool({
  log,
  isRunning,
  onAnswer,
}: Props) {
  switch (log.tool_name) {
    case ToolName.Curl:
      return <Curl log={log} isRunning={isRunning} />
    case ToolName.InstallNPMDependencies:
      return <InstallNPMDeps log={log} isRunning={isRunning} />
    case ToolName.WriteJavaScriptCode:
      return <WriteCode log={log} isRunning={isRunning} />
    case ToolName.RunSavedCode:
      return <RunSavedCode log={log} isRunning={isRunning} />
    case ToolName.AskHuman:
      return <AskHuman log={log} onAnswer={onAnswer} isRunning={isRunning} />
    case ToolName.LetHumanChoose:
      return <LetHumanChoose log={log} onAnswer={onAnswer} isRunning={isRunning} />
    default:
      return <div>Cannot render frontend component - unknown tol {log.tool_name}</div>
  }
}

export default Tool