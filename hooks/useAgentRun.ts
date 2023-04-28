import { useCallback, useState } from 'react'
import { deployment_state } from '@prisma/client'

import { AgentRun, Step } from 'api-client/AgentRun'
import { ModelConfig } from 'state/model'
import { baseUrl } from 'api-client/api'

function useAgentRun() {
  const [agentRun, setAgentRun] = useState<AgentRun>()
  const [steps, setSteps] = useState<Step[]>()
  const [agentState, setAgentState] = useState<deployment_state>()

  const start = useCallback(async (projectID: string, modelConfig: ModelConfig) => {
    const run = new AgentRun(`${baseUrl}/dev/agent`, {
      onSteps: setSteps,
      onStateChange: setAgentState,
      onClose: () => setAgentRun(undefined),
    })

    setSteps([])
    setAgentRun(run)
    await run.connect()
    try {
      await run.startRun(projectID, modelConfig)
    } catch (error) {
      setAgentState(deployment_state.error)
      console.error(error)
    }
  }, [setAgentRun, setSteps, setAgentState])

  return {
    start,
    agentRun,
    steps,
    agentState,
  }
}

export default useAgentRun
