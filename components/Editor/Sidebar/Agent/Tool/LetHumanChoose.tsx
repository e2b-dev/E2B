import {
  Fragment,
  useMemo,
} from 'react'
import {
  HelpCircle,
} from 'lucide-react'

import Text from 'components/Text'
import { ToolName, ToolLog } from 'db/types'

import Base from './Base'

export interface Props {
  log: ToolLog
  isRunning?: boolean
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
}

function LetHumanChoose({
  log,
  isRunning,
  onAnswer,
}: Props) {
  if (log.tool_name !== ToolName.LetHumanChoose) throw new Error(`'${log.tool_name}': This component supports only logs for '${ToolName.LetHumanChoose}' tool`)

  const body = useMemo(() => {
    const xmlString = log.tool_input.trim()
    if (!xmlString) {
      console.error('LetHumanChoose: Tool input is empty')
      return
    }

    try {
      const parser = new DOMParser()
      const xml = parser.parseFromString(`<root>${xmlString}</root>`, 'text/xml')
      const question = xml.querySelector('question')
      const options = xml.querySelectorAll('option')

      if (!question) {
        throw new Error('LetHumanChoose: No question found')
      }

      if (options.length === 0) {
        throw new Error('LetHumanChoose: No options found')
      }

      return (
        <div className="
          flex
          flex-col
          items-stretch
          space-y-2
        ">
          <Text
            className="font-medium"
            text={`AI: ${question.textContent}`}
          />

          <div
            className="
              flex
              flex-col
              space-y-1
              items-stretch
            "
          >
            {[...options].map((option, idx) => (
              <Fragment
                key={idx}
              >
                {(option.textContent !== null && option.textContent) ? (
                  <div
                    key={idx}
                    className={`
                      border
                      hover:border-green-600
                      ${log.tool_output === option.textContent ? 'border-green-600' : ''}
                      transition-all
                      rounded
                      p-2
                      cursor-pointer
                    `}
                    onClick={() => onAnswer?.({ logID: log.id, answer: option.textContent!, toolName: ToolName.LetHumanChoose })}
                  >
                    <Text
                      text={option.textContent}
                      size={Text.size.S2}
                    />
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      )
    } catch (err) {
      console.error('LetHumanChoose: Error parsing XML:', err)
      return null
    }
  }, [
    log.id,
    log.tool_input,
    log.tool_output, onAnswer,
  ])

  return (
    <Base
      isRunning={isRunning}
      log={log}
      icon={<HelpCircle size="16px" />}
      body={body}
    />
  )
}

export default LetHumanChoose
