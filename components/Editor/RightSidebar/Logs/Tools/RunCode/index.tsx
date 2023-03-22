import { ToolName, ToolLog } from 'db/types'

export interface Props {
  log: ToolLog
}

function RunCode({
  log,
}: Props) {
  if (log.tool_name !== ToolName.RunJavaScriptCode) throw new Error(`'${log.tool_name}': This component supports only logs for 'RunJavaScriptCode' tool`)

  return (

  )
}

export default RunCode