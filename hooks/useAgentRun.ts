import { useCallback, useState } from 'react'

import { AgentRun } from 'api-client/AgentDebugRun'
import { Log } from 'db/types'
import { ModelConfig } from 'state/model'
import { baseUrl } from 'api-client/api'
import { deployment_state } from '@prisma/client'

function useAgentRun() {
  const [agentRun, setAgentRun] = useState<AgentRun>()
  const [logs, setLogs] = useState<Log[]>([])
  const [agentState, setAgentState] = useState<deployment_state>()

  const start = useCallback(async (projectID: string, modelConfig: ModelConfig) => {
    const run = new AgentRun(`${baseUrl}/dev/agent`, {
      onLogs: setLogs,
      onStateChange: setAgentState,
    })

    setLogs([])
    setAgentRun(run)
    await run.connect()
    return run.startRun(projectID, modelConfig)
  }, [setAgentRun, setLogs])

  return {
    start,
    agentRun,
    logs,
    agentState,
  }
}

export default useAgentRun
