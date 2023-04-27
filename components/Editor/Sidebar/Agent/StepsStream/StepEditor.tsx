import { useEffect, useMemo, useState, MouseEvent } from 'react'
import clsx from 'clsx'
import TextareaAutosize from 'react-textarea-autosize'
import { Check, X } from 'lucide-react'

import { LogType, ToolName, } from 'db/types'

import LogEntry from '../LogEntry'
import Text from 'components/Text'
import { Step } from 'api-client/AgentRun'
import { notEmpty } from 'utils/notEmpty'


export interface Props {
  step: Step
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
  stepIdx: number
  onEditFinish: (output: string) => void
}

function StepEditor({
  step,
  onAnswer,
  stepIdx,
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
      onClick={() => setIsEditing(e => true)}
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
          cursor-text
          relative
          transition-all
        "
      >
        {isEditing &&
          <TextareaAutosize
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
                tracking-normal
                font-sans
                bg-slate-50
                rounded
                border-slate-300
                border-l-4
                p-3
                `,
              'text-slate-500',
              'no-scroller',
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
              key={i}
              className="
            flex
            flex-col
          "
            >
              <LogEntry
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
