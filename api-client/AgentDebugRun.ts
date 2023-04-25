import { RpcWebSocketClient, IRpcNotification } from 'rpc-websocket-client'
import { deployment_state } from '@prisma/client'

import { Log } from 'db/types'
import { ModelConfig } from 'state/model'

export interface Opts {
  onLogs: (logs: Log[]) => void
  onStateChange: (runState: deployment_state) => void
}

export class AgentRun {
  private readonly rpc = new RpcWebSocketClient()
  runID?: string

  constructor(private readonly url: string, private readonly opts: Opts) {
    this.rpc.onNotification.push(this.handleNotification.bind(this))
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
    console.log('notif', data)
    if (data.method === 'logs') {
      return this.opts.onLogs(data.params.logs)
    }
    if (data.method === 'stateUpdate') {
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
    await this.rpc.call('pause')
  }

  async resumeRun() {
    await this.rpc.call('resume')
  }

  async cancelRun() {
    await this.rpc.call('cancel')
  }

  async rewriteRunLogs(logs: Log[]) {
    await this.rpc.call('rewriteLogs', [logs])
  }
}
