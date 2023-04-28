import { useEffect, useRef } from 'react'

import { ToolName, } from 'db/types'
import { Step, StepEdit } from 'api-client/AgentRun'

import StepEditor from './StepEditor'

export interface Props {
  steps?: Step[]
  isRunning?: boolean
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
  onEdit: (edit: StepEdit) => void
}

function StepsStream({
  steps,
  onAnswer,
  isRunning,
  onEdit,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(function scrollLogs() {
    if (!ref.current) return
    if (!isRunning) return

    ref.current.scrollIntoView({ behavior: 'smooth' })
  }, [steps, isRunning])

  useEffect(function scrollLogs() {
    if (!ref.current) return
    if (isRunning) return

    ref.current.scrollIntoView({ behavior: 'auto' })
  }, [steps, isRunning])

  return (
    <div
      className="
        flex-1
        overflow-auto
        text-xs
        tracking-wide
        font-sans
        scroller
        whitespace-pre-wrap
        py-4
        flex
        flex-col
        bg-slate-50
        space-y-4
        px-2
    ">
      {steps?.map((s, i) =>
        <StepEditor
          onEditFinish={output => onEdit({ stepIdx: i, output })}
          step={s}
          isRunning={isRunning}
          stepIdx={i}
          key={i}
          onAnswer={onAnswer}
        />
      )}
      <div ref={ref} />
    </div>
  )
}

export default StepsStream
