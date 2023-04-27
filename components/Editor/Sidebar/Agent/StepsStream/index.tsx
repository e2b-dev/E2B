import { useEffect, useRef } from 'react'

import { ToolName, } from 'db/types'
import { Step, StepEdit } from 'api-client/AgentRun'

import StepEditor from './StepEditor'

export interface Props {
  steps?: Step[]
  onAnswer?: (args: { logID: string, answer: string, toolName: ToolName }) => void
  isDeployRequestRunning?: boolean
  onEdit: (edit: StepEdit) => void
}

function StepsStream({
  steps,
  onAnswer,
  isDeployRequestRunning,
  onEdit,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(function scrollLogs() {
    if (!ref.current) return
    if (!isDeployRequestRunning) return

    ref.current.scrollIntoView({ behavior: 'smooth' })
  }, [steps, isDeployRequestRunning])

  useEffect(function scrollLogs() {
    if (!ref.current) return
    if (isDeployRequestRunning) return

    ref.current.scrollIntoView({ behavior: 'auto' })
  }, [steps, isDeployRequestRunning])

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
