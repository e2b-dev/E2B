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

export interface Opts {
  onSteps: (steps: Step[]) => void
  onClose: () => void
  onStateChange: (runState: deployment_state) => void
}

export class AgentRun {
  private readonly rpc = new RpcWebSocketClient()
  runID?: string

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
    this.rpc.ws?.close()
  }

  private handleNotification(data: IRpcNotification) {
    if (data.method === 'steps') {
      return this.opts.onSteps(data.params.steps)
    }
    if (data.method === 'state_update') {
      this.opts.onStateChange(data.params.state)
      if (data.params.state === deployment_state.finished) {
        this.disconnect()
      }
    }
  }

  async startRun(projectID: string, modelConfig: ModelConfig) {
    const { run_id } = await this.rpc.call('start', [projectID, modelConfig]) as { run_id: string }
    this.runID = run_id
    this.opts.onStateChange(deployment_state.generating)
  }

  async pauseRun() {
    if (!this.runID) return
    await this.rpc.call('pause')
  }

  async resumeRun() {
    if (!this.runID) return
    await this.rpc.call('resume')
  }

  async cancelRun() {
    if (!this.runID) return
    await this.rpc.call('cancel')
  }

  async rewriteRunSteps(steps: Step[]) {
    if (!this.runID) return
    await this.rpc.call('rewrite_steps', [steps])
  }

  static resolveStepsEdit(steps: Step[], edit: StepEdit): Step[] | undefined {
    const step = steps[edit.stepIdx]
    if (!step) {
      throw new Error('Step does not exist')
    }
    if (step.output === edit.output) return
    step.output = edit.output
    step.logs = []

    // return steps without steps after edited step
    return steps.slice(0, edit.stepIdx + 1)
  }
}
