import Logger from 'src/utils/Logger'
import { runner as consts } from 'src/core/constants'

export enum KeepAliveStatus {
  Ok = 'Ok',
  Terminated = 'Terminated',
}

export interface KeepAliveResponse {
  status: KeepAliveStatus
  lastPing?: Date
  sessionID?: string
}

/**
 * `RunnerSession` represents an active session.
 */
class RunnerSession {
  private logger = new Logger('RunnerSession')
  private readonly url = `https://${consts.REMOTE_RUNNER_HOSTNAME}`

  constructor(
    readonly id: string,
    private lastPing: Date = new Date()
  ) { }

  async ping() {
    this.logger.log(`Pinging session "${this.id}"`)
    const body = JSON.stringify({
      sessionID: this.id,
    })

    try {
      const resp = await fetch(`${this.url}/session/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })

      const json = await resp.json()

      // >299
      if (!resp.ok) {
        this.logger.error(resp.headers, json)
        throw new Error('Non-OK response when trying to ping active Runner session')
      }

      const response = json as KeepAliveResponse
      if (response.status === KeepAliveStatus.Terminated) {
        throw new Error(`[keepAlive]: Session '${this.id}' is terminated`)
      }

      this.lastPing = new Date()
    } catch (err) {
      this.logger.error(err)
      throw new Error('Failed to ping active Runner session')
    }
  }
}

export default RunnerSession
