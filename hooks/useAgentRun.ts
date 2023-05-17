import { useCallback, useState } from 'react'

import { AgentRun, AgentRunState, Step } from 'api-client/AgentRun'
import { ModelConfig } from 'state/model'
import { baseUrl } from 'api-client/api'

function useAgentRun() {
  const [agentRun, setAgentRun] = useState<AgentRun>()
  const [steps, setSteps] = useState<Step[]>()
  const [agentState, setAgentState] = useState<AgentRunState>()

  const start = useCallback(async (projectID: string, modelConfig: ModelConfig) => {
    const run = new AgentRun(`${baseUrl}/dev/agent`, {
      onSteps: setSteps,
      onStateChange: setAgentState,
      onClose: () => {
        setAgentRun(undefined)
        setAgentState(undefined)
      },
    })

    setSteps([])
    setAgentRun(run)
    await run.connect()
    await run.startRun(projectID, modelConfig)
  }, [setAgentRun, setSteps, setAgentState])

  return {
    start,
    agentRun,
    steps,
    agentState,
  }
}

export default useAgentRun
