import { useEffect, useMemo, useState, MouseEvent } from 'react'
import clsx from 'clsx'
import { Check, X } from 'lucide-react'

import { LogType, ToolName, } from 'db/types'

import LogEntry from '../LogEntry'
import Text from 'components/Text'
import { Step } from 'api-client/AgentConnection'
import { notEmpty } from 'utils/notEmpty'

export interface Props {
  step: Step
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
  stepIdx: number
  isRunning?: boolean
  onEditFinish: (output: string) => void
}

function StepEditor({
  step,
  onAnswer,
  stepIdx,
  isRunning,
  onEditFinish,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedOutput, setEditedOutput] = useState(step.output)

  useEffect(function resetEditedOutput() {
    setEditedOutput(step.output)
  }, [step])

  function handleEditFinish(e: MouseEvent<HTMLElement>) {
    onEditFinish(editedOutput)
    setIsEditing(false)
    e.stopPropagation()
  }

  function cancelEdit(e: MouseEvent<HTMLElement>) {
    setIsEditing(false)
    setEditedOutput(step.output)
    e.stopPropagation()
  }

  const trimmedLogs = useMemo(() => {
    return step.logs
      ?.map(l => {
        switch (l.type) {
          case LogType.Thought:
            const content = l.content
              .replaceAll('\nAction:', '')
              .replaceAll('Action:', '')
              .replaceAll('Thought:', '')
              .trim()
            return content
              ? {
                ...l,
                content,
              }
              : undefined
          default:
            return l
        }
      })
      .filter(notEmpty)
  }, [step.logs])

  return (
    <div
      className="
      flex
      flex-col
      space-y-2
      "
    >
      <div
        className="
        flex
        space-x-2
        justify-between
        "
      >
        <Text
          size={Text.size.S3}
          className="
          text-slate-400
          py-[1px]
          "
          text={`Step ${stepIdx + 1}`}
        />
        {isEditing &&
          <Text
            size={Text.size.S3}
            className="
          text-slate-400
          py-[1px]
          italic
          "
            text="editing"
          />
        }
        {isEditing &&
          <div
            className="
              flex
              space-x-2
          "
          >
            <div
              onClick={handleEditFinish}
              className="
                cursor-pointer
                transition-all
                hover:text-slate-600
                text-slate-500
                z-50
              "
            >
              <Check size="18px" />
            </div>
            <div
              onClick={cancelEdit}
              className="
                cursor-pointer
                transition-all
                hover:text-slate-600
                text-slate-500
                z-50
              "
            >
              <X size="18px" />
            </div>
          </div>
        }
      </div>
      <div
        className="
          flex
          flex-col
          relative
          h-full
          w-full
        "
      >
        {isEditing &&
          <textarea
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            value={editedOutput}
            onChange={e => setEditedOutput(e.target.value)}
            className={clsx(
              `
                whitespace-pre-wrap
                flex
                w-full
                h-full
                absolute
                flex-1
                text-sm
                z-40
                border
                leading-[16px]
                transition-all
                tracking-normal
                font-sans
                rounded
                resize-none
                border-dashed
                border-slate-300
                pl-3
                py-4
                pr-2
                `,
              'text-slate-500',
              'scroller',
              'outline-none',
            )}
          />
        }
        <div
          className={clsx(`
          flex
          flex-col
          space-y-4
          `,
            { 'invisible': isEditing },
          )}
        >
          {trimmedLogs.map((l, i) =>
            <div
              onClick={() => setIsEditing(true)}
              key={i}
              className="
              cursor-text
              flex
              flex-col
          "
            >
              <LogEntry
                isRunning={isRunning}
                onAnswer={onAnswer}
                log={l}
              />
            </div>
          )}
        </div>
      </div>
    </div >
  )
}

export default StepEditor
