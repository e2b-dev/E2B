import { ReactNode, memo, useMemo, useCallback } from 'react'
import { Ban, Pause, Play } from 'lucide-react'

import Button from 'components/Button'
import { AgentConnection, AgentRunState } from 'api-client/AgentConnection'


export interface Props {
  agentState?: AgentRunState
  run: () => void
  agentRun?: AgentConnection
  disabled?: boolean
}

function AgentRunControls({
  agentRun,
  disabled,
  agentState,
  run,
}: Props) {
  const cancel = useCallback(async () => {
    await agentRun?.cancelRun()
  }, [agentRun])

  const pause = useCallback(async () => {
    await agentRun?.pauseRun()
  }, [agentRun])

  const resume = useCallback(async () => {
    await agentRun?.resumeRun()
  }, [agentRun])

  const { action, icon, text } = useMemo<{
    text: string
    icon: ReactNode | null
    action: () => void
  }>(() => {
    switch (agentState) {
      case AgentRunState.Running:
        return {
          text: 'Running',
          icon: <Pause size="16px" />,
          action: pause,
        }
      case AgentRunState.Paused:
        return {
          text: 'Resume',
          icon: <Play size="16px" />,
          action: resume,
        }
      default:
        return {
          icon: <Play size="16px" />,
          text: 'Run',
          action: run,
        }
    }
  }, [agentState, pause, run, resume])

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
