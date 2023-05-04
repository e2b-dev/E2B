import { RpcWebSocketClient, IRpcNotification } from 'rpc-websocket-client'
import { deployment_state } from '@prisma/client'

import { Log } from 'db/types'
import { ModelConfig } from 'state/model'


export interface Step {
  output: string
  logs: Log[]
}

export interface StepEdit {
  stepIdx: number
  output: string
}

export enum AgentRunState {
  None,
  Running,
  Paused,
}

export interface Opts {
  onSteps: (steps: Step[]) => void
  onClose: () => void
  onStateChange: (runState: AgentRunState) => void
}

export class AgentConnection {
  private readonly rpc = new RpcWebSocketClient()

  constructor(private readonly url: string, private readonly opts: Opts) {
    this.rpc.onNotification.push(this.handleNotification.bind(this))
    this.rpc.onClose(opts.onClose)
  }

  async connect() {
    await this.rpc.connect(this.url.replace('http', 'ws'))
  }

  async disconnect() {
    console.log('closing')
    // This is the browser WebSocket way of closing connection
    // TODO: Test this connection closing
    this.rpc.ws?.close()
  }

  private handleNotification(data: IRpcNotification) {
    if (data.method === 'logs') {
      if (data.params.logs) {
        this.opts.onSteps(data.params.logs)
      }
      // return this.opts.onSteps(data.params.steps)
      if (data.params.state) {
        this.opts.onStateChange(data.params.state)
        if (data.params.state === deployment_state.finished) {
          this.disconnect()
        }
      }
    }
  }

  async start(projectID: string, modelConfig: ModelConfig) {
    await this.rpc.call('start', {
      'project_id': projectID,
      'model_config': modelConfig,
    })

    this.opts.onStateChange(AgentRunState.Running)
  }

  private async interaction(type: string, data?: any) {
    await this.rpc.call('interaction', { type, data })
  }

  async pauseRun() {
    await this.interaction('pause')
    this.opts.onStateChange(AgentRunState.Paused)
  }

  async resumeRun() {
    await this.interaction('resume')
    this.opts.onStateChange(AgentRunState.Running)
  }

  async cancelRun() {
    await this.rpc.call('stop')
    this.opts.onStateChange(AgentRunState.None)
  }

  async rewriteRunSteps(steps: Step[]) {
    await this.interaction('rewrite_steps', { steps })
    this.opts.onStateChange(AgentRunState.Running)
  }

  static resolveStepsEdit(steps: Step[], edit: StepEdit): Step[] | undefined {
    const step = steps[edit.stepIdx]
    if (!step) {
      throw new Error('Step does not exist')
    }
    if (step.output === edit.output) return
    step.output = edit.output
    step.logs = []

    return steps.slice(0, edit.stepIdx + 1)
  }
}
