import { deployment_state } from '@prisma/client'
import { ReactNode, memo, useState, useMemo, useCallback, useEffect } from 'react'
import { Ban, Pause, Play } from 'lucide-react'

import Button from 'components/Button'
import { AgentRun } from 'api-client/AgentRun'


export interface Props {
  agentState?: deployment_state
  run: () => void
  agentRun?: AgentRun
  disabled?: boolean
}

function AgentRunControls({
  agentRun,
  disabled,
  agentState,
  run,
}: Props) {
  const [isPaused, setIsPaused] = useState(false)

  useEffect(function resetRun() {
    if (agentRun) {
      setIsPaused(false)
    }
  }, [agentRun])

  const cancel = useCallback(async () => {
    await agentRun?.cancelRun()
    setIsPaused(false)
  }, [agentRun])

  const pause = useCallback(async () => {
    await agentRun?.pauseRun()
    setIsPaused(true)
  }, [agentRun, setIsPaused])

  const resume = useCallback(async () => {
    await agentRun?.resumeRun()
    setIsPaused(false)
  }, [agentRun, setIsPaused])

  const { action, icon, text } = useMemo<{
    text: string
    icon: ReactNode | null
    action: () => void
  }>(() => {
    if (agentRun) {
      switch (agentState) {
        case deployment_state.generating:
          if (isPaused) {
            return {
              text: 'Resume',
              icon: <Play size="16px" />,
              action: resume,
            }
          } else {
            return {
              text: 'Running',
              icon: <Pause size="16px" />,
              action: pause,
            }
          }
        case deployment_state.error:
        case deployment_state.finished:
        default:
      }
    }
    return {
      icon: <Play size="16px" />,
      text: 'Run',
      action: run,
    }
  }, [agentState, agentRun, isPaused, pause, run, resume])

  return (
    <>
      {agentRun && agentState &&
        <Button
          onClick={cancel}
          variant={Button.variant.Outline}
          icon={<Ban size="16px" />}
        />
      }
      <Button
        text={text}
        onClick={action}
        isDisabled={disabled}
        variant={Button.variant.Full}
        icon={icon}
      />
    </>
  )
}

export default memo(AgentRunControls)
