import {
  HelpCircle,
} from 'lucide-react'

// import Text from 'components/Text'
// import Input from 'components/Input'
// import Button from 'components/Button'
import { ToolName, ToolLog } from 'db/types'

import Base from './Base'

export interface Props {
  log: ToolLog
}

function LetHumanChoose({
  log,
}: Props) {
  if (log.tool_name !== ToolName.LetHumanChoose) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.LetHumanChoose}' tool`)

  const body = (
    <div>
      {log.tool_input.trim()}
    </div>
  )

  return (
    <Base
      log={log}
      icon={<HelpCircle size="16px" />}
      body={body}
    />
  )
}

export default LetHumanChoose