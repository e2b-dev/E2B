import { ToolLog, ToolName } from 'db/types'

import AskHuman from './AskHuman'
import Curl from './Curl'
import InstallNPMDeps from './InstallNPMDeps'
import WriteCode from './WriteCode'
import RunSavedCode from './RunSavedCode'
import LetHumanChoose from './LetHumanChoose'

export interface Props {
  log: ToolLog
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
}

function Tool({
  log,
  onAnswer,
}: Props) {
  switch (log.tool_name) {
    case ToolName.Curl:
      return <Curl log={log} />
    case ToolName.InstallNPMDependencies:
      return <InstallNPMDeps log={log} />
    case ToolName.WriteJavaScriptCode:
      return <WriteCode log={log} />
    case ToolName.RunSavedCode:
      return <RunSavedCode log={log} />
    case ToolName.AskHuman:
      return <AskHuman log={log} onAnswer={onAnswer} />
    case ToolName.LetHumanChoose:
      return <LetHumanChoose log={log} onAnswer={onAnswer} />
    default:
      return <div>Cannot render frontend component - unknown tol {log.tool_name}</div>
  }
}

export default Tool