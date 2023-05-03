import { useCallback, useState } from 'react'

import { AgentConnection, AgentRunState, Step } from 'api-client/AgentConnection'
import { ModelConfig } from 'state/model'
import { baseUrl } from 'api-client/api'

function useAgentRun() {
  const [agentRun, setAgentRun] = useState<AgentConnection>()
  const [steps, setSteps] = useState<Step[]>()
  const [agentState, setAgentState] = useState<AgentRunState>()

  const start = useCallback(async (projectID: string, modelConfig: ModelConfig) => {
    const run = new AgentConnection(`${baseUrl}/dev/agent`, {
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
    await run.start(projectID, modelConfig)
  }, [setAgentRun, setSteps, setAgentState])

  return {
    start,
    agentRun,
    steps,
    agentState,
  }
}

export default useAgentRun
