import { ToolName, ToolLog } from 'db/types'

export interface Props {
  log: ToolLog
}

function RunCode({
  log,
}: Props) {
  if (log.name !== ToolName.RunJavaScriptCode) throw new Error(`'${log.name}': This component supports only logs for 'RunJavaScriptCode' tool`)

  return (

  )
}

export default RunCode