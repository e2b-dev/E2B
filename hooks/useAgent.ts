import { useCallback, useState } from 'react'

import { AgentConnection, AgentRunState, Step } from 'api-client/AgentConnection'
import { ModelConfig } from 'state/model'
import { baseUrl } from 'api-client/api'

function useAgent(projectID: string) {
  const [agentRun, setAgentRun] = useState<AgentConnection>()
  const [steps, setSteps] = useState<Step[]>()
  const [agentState, setAgentState] = useState<AgentRunState>()

  const run = useCallback(async (
    config: ModelConfig,
    prompt: any,
  ) => {
    const run = new AgentConnection(`${baseUrl}/dev/agent`, {
      onSteps: setSteps,
      onStateChange: setAgentState,
      onClose: () => {
        setAgentRun(undefined)
        setAgentState(undefined)
      },
    }, projectID)

    setSteps([])
    setAgentRun(run)
    await run.connect()
    await run.start(config, prompt)
  }, [setAgentRun, setSteps, setAgentState, projectID])

  return {
    run,
    agentRun,
    steps,
    agentState,
  }
}

export default useAgent
