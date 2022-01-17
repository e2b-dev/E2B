import * as rws from 'src/common-ts/RunnerWebSocket'
import { WebSocketConnection } from 'src/core/webSocketConnection'
import Logger from 'src/utils/Logger'
import { TemplateID } from 'src/core/constants'

import {
  RunningEnvironment,
  ws as envWS,
} from './runningEnvironment'

export interface EvaluationContextOpts {
  contextID: string
  debug?: boolean
  conn: WebSocketConnection
  onCmdOut?: (payload: rws.RunningEnvironment_CmdOut['payload']) => any
  onEnvChange?: (env: RunningEnvironment) => any
}

class EvaluationContext {
  private logger?: Logger

  get contextID() {
    return this.opts.contextID
  }

  envs: RunningEnvironment[] = []

  private unsubscribeConnHandler: () => void

  constructor(private readonly opts: EvaluationContextOpts) {
    if (opts.debug) {
      this.logger = new Logger('EvaluationContext')
    }
    this.unsubscribeConnHandler = this.opts.conn.subscribeHandler({
      onOpen: this.restart.bind(this),
      onMessage: this.handleConnectionMessage.bind(this),
    })
  }

  /**
   * Restarts all context's objects to their default state.
   * This method should be called only after the new WS connection is estabilished.
   */
  restart() {
    this.logger?.log('Restart - session:', this.opts.conn.sessionID)
    return this.envs.forEach(env => {
      env.isReady = false
      envWS.start(this.opts.conn, {
        environmentID: env.id,
        template: env.template,
      })
    })
  }

  destroy() {
    this.logger?.log('Destroy')
    this.envs = []
    this.unsubscribeConnHandler()
  }

  private handleConnectionMessage(message: rws.BaseMessage) {
    this.logger?.log('Handling message from remote Runner', { message })
    switch (message.type) {
      case rws.MessageType.RunningEnvironment.StartAck: {
        const msg = message as rws.RunningEnvironment_StartAck
        this.vmenv_handleStartAck(msg.payload)
        break
      }
      case rws.MessageType.RunningEnvironment.CmdOut: {
        const msg = message as rws.RunningEnvironment_CmdOut
        this.vmenv_handleCmdOut(msg.payload)
        break
      }
      default:
        this.logger?.warn('Unknown message type', { message })
    }
  }

  deleteRunningEnvironment({ templateID }: { templateID: string }) {
    this.logger?.log('Handling "DeleteEnvironment"', { templateID })
    this.envs = this.envs.filter(env => env.templateID !== templateID)
  }

  createRunningEnvironment({ templateID }: { templateID: TemplateID }) {
    this.logger?.log('Handling "CreateEnvironment"', { templateID })

    const existingEnv = this.envs.find(e => e.templateID === templateID)
    if (existingEnv) return existingEnv

    const env = new RunningEnvironment(this.contextID, templateID)
    this.envs = [
      ...this.envs,
      env,
    ]
    envWS.start(this.opts.conn, {
      environmentID: env.id,
      template: env.template,
    })
    this.opts.onEnvChange?.(env)
    return env
  }

  vmenv_handleStartAck(payload: rws.RunningEnvironment_StartAck['payload']) {
    this.logger?.log('[vmenv] Handling "StartAck"', { payload })
    const env = this.envs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger?.warn('Environment not found', { payload })
      return
    }
    env.isReady = true
    this.opts.onEnvChange?.(env)
  }

  vmenv_handleCmdOut(payload: rws.RunningEnvironment_CmdOut['payload']) {
    this.logger?.log('[vmenv] Handling "CmdOut"', payload)
    this.opts.onCmdOut?.(payload)
  }

  executeCommand({ templateID, executionID, command }: { templateID: string, executionID: string, command: string }) {
    this.logger?.log('Exec shell code cell', { templateID, executionID, command })

    const env = this.envs.find(env => env.templateID === templateID)
    if (!env) {
      this.logger?.error('Environment not found', { templateID, executionID, command })
      return
    }

    if (!env.isReady) {
      this.logger?.error('Environment is not ready', { templateID, executionID, command })
      return
    }

    envWS.execCmd(this.opts.conn, {
      environmentID: env.id,
      executionID,
      command,
    })
  }
}

export default EvaluationContext
