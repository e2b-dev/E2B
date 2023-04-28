import {
  useCallback,
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
  isRunning?: boolean
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
}

function AskHuman({
  log,
  isRunning,
  onAnswer,
}: Props) {
  if (log.tool_name !== ToolName.AskHuman) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.AskHuman}' tool`)
  const [answer, setAnswer] = useState('')

  const handleAnswer = useCallback(() => {
    if (log.tool_output) return
    onAnswer?.({ logID: log.id, answer, toolName: ToolName.AskHuman })
  }, [answer, onAnswer, log.id, log.tool_output])

  const body = log.tool_input.trim()
    ? (
      <div className="
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
            isDisabled={!!log.tool_output}
            placeholder="What do you think the AI should do?"
            onChange={val => setAnswer(val)}
            value={answer}
          />
          <Button
            icon={<Send size="14px" />}
            text="Answer"
            onClick={handleAnswer}
          />
        </div>
      </div>
    )
    : null

  return (
    <Base
      isRunning={isRunning}
      log={log}
      icon={<HelpCircle size="16px" />}
      body={body}
    />
  )
}

export default AskHuman
