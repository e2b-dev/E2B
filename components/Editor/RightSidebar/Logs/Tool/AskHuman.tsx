import {
  ReactNode,
  useState,
} from 'react'
import {
  HelpCircle,
  Send,
} from 'lucide-react'

import Text from 'components/Text'
import Input from 'components/Input'
import Button from 'components/Button'
import { ToolName, ToolLog } from 'db/types'

import Base from './Base'

export interface Props {
  log: ToolLog
}

function AskHuman({
  log,
}: Props) {
  if (log.tool_name !== ToolName.AskHuman) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.AskHuman}' tool`)

  const [answer, setAnswer] = useState('')

  function sendAnswer() {

  }

  let body: ReactNode = null
  if (log.tool_input.trim()) {
    body = (
      <div className="
        pt-2
        flex
        flex-col
        items-stretch
        space-y-2
      ">
        <Text
          className="font-medium"
          text={`AI: ${log.tool_input.trim()}`}
        />
        <div className="
          flex
          items-center
          space-x-2
        ">
          <Input
            placeholder="What do you think the AI should do?"
            onChange={val => setAnswer(val)}
            value={answer}
          />
          <Button
            icon={<Send size="14px" />}
            text="Answer"
            onClick={sendAnswer}
          />
        </div>
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