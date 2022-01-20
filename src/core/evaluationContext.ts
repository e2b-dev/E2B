// This Node builtin is polyfilled with Rollup
import path from 'path'

import * as rws from 'src/common-ts/RunnerWebSocket'
import { WebSocketConnection } from 'src/core/webSocketConnection'
import Logger from 'src/utils/Logger'
import {
  Env,
  templates,
} from 'src/core/constants'

import {
  RunningEnvironment,
  ws as envWS,
} from './runningEnvironment'
import { SessionStatus } from './session/sessionManager'

export interface EvaluationContextOpts {
  contextID: string
  debug?: boolean
  conn: WebSocketConnection
  onCmdOut?: (payload: rws.RunningEnvironment_CmdOut['payload']) => void
  onSessionChange?: (session: { status: SessionStatus }) => void
  onEnvChange?: (env: RunningEnvironment) => void
}

type FSWriteSubscriber = (payload: rws.RunningEnvironment_FSEventWrite['payload']) => void

class EvaluationContext {
  private readonly logger: Logger

  private get contextID() {
    return this.opts.contextID
  }

  private fsWriteSubscribers: FSWriteSubscriber[] = []

  private envs: RunningEnvironment[] = []
  private readonly unsubscribeConnHandler: () => void

  constructor(private readonly opts: EvaluationContextOpts) {
    this.logger = new Logger('EvaluationContext', opts.debug)

    this.unsubscribeConnHandler = this.opts.conn.subscribeHandler({
      onOpen: this.handleConnectionOpen.bind(this),
      onMessage: this.handleConnectionMessage.bind(this),
      onClose: this.handleConnectionClose.bind(this),
    })

    if (this.opts.conn.isOpen) {
      this.handleConnectionOpen()
    }
    if (this.opts.conn.isClosed) {
      this.handleConnectionClose()
    }
  }

  /**
   * Restarts all context's objects to their default state.
   * This method should be called only after the new WS connection is estabilished.
   */
  restart() {
    this.logger.log('Restart', this.opts.conn.sessionID)
    return this.envs.forEach(env => {
      env.isReady = false
      envWS.start(this.opts.conn, {
        environmentID: env.id,
        template: env.template,
      })
    })
  }

  destroy() {
    this.logger.log('Destroy')
    this.unsubscribeConnHandler()
    this.envs = []
    this.fsWriteSubscribers = []
  }

  async executeCode({ templateID, executionID, code }: { templateID: Env, executionID: string, code: string }) {
    this.logger.log('Execute code', { templateID, executionID })

    const env = this.envs.find(env => env.templateID === templateID)
    if (!env) {
      this.logger.error('Environment not found', { templateID, executionID })
      return
    }
    if (!env.isReady) {
      this.logger.error('Environment is not ready', { templateID, executionID })
      return
    }

    const extension = templates[templateID].fileExtension
    const basename = `${executionID}${extension}`
    const filepath = path.join('/src', basename)

    let resolveFileWritten: (value: void) => void
    const fileWritten = new Promise<void>((resolve, reject) => {
      resolveFileWritten = resolve
      setTimeout(() => {
        reject()
      }, 10000)
    })

    const fsWriteSubscriber = (payload: rws.RunningEnvironment_FSEventWrite['payload']) => {
      if (!payload.path.endsWith(filepath)) return
      resolveFileWritten()
    }
    this.subscribeFSWrite(fsWriteSubscriber)

    envWS.writeFile(this.opts.conn, {
      environmentID: env.id,
      path: filepath,
      content: code,
    })

    try {
      await fileWritten
    } catch (err: any) {
      this.logger.error(`File ${filepath} not written to VM`)
      return
    } finally {
      this.unsubscribeFSWrite(fsWriteSubscriber)
    }

    // Send command to execute file as code
    const vmFilepath = path.join(templates[templateID].root_dir, filepath)
    const command = templates[templateID].toCommand(vmFilepath)
    envWS.execCmd(this.opts.conn, {
      environmentID: env.id,
      executionID,
      command,
    })
  }

  executeCommand({ templateID, executionID, command }: { templateID: Env, executionID: string, command: string }) {
    this.logger.log('Execute shell command', { templateID, executionID, command })

    const env = this.envs.find(env => env.templateID === templateID)
    if (!env) {
      this.logger.error('Environment not found', { templateID, executionID, command })
      return
    }
    if (!env.isReady) {
      this.logger.error('Environment is not ready', { templateID, executionID, command })
      return
    }

    envWS.execCmd(this.opts.conn, {
      environmentID: env.id,
      executionID,
      command,
    })
  }

  createRunningEnvironment({ templateID }: { templateID: Env }) {
    this.logger.log('Creating running environment', { templateID })

    const existingEnv = this.envs.find(e => e.templateID === templateID)
    if (existingEnv) return

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
  }

  private subscribeFSWrite(subscriber: FSWriteSubscriber) {
    this.fsWriteSubscribers.push(subscriber)
  }

  private unsubscribeFSWrite(subscriber: FSWriteSubscriber) {
    this.fsWriteSubscribers = this.fsWriteSubscribers.filter(s => s !== subscriber)
  }

  private handleConnectionOpen() {
    this.restart()
    this.opts.onSessionChange?.({ status: SessionStatus.Connected })
  }

  private handleConnectionClose() {
    this.opts.onSessionChange?.({ status: SessionStatus.Connecting })
  }

  private handleConnectionMessage(message: rws.BaseMessage) {
    this.logger.log('Handling message from remote Runner', { message })
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
      case rws.MessageType.RunningEnvironment.CmdExit: {
        const msg = message as rws.RunningEnvironment_CmdExit
        this.vmenv_handleCmdExit(msg.payload)
        break
      }
      case rws.MessageType.RunningEnvironment.FSEventWrite: {
        const msg = message as rws.RunningEnvironment_FSEventWrite
        this.vmenv_handleFSEventWrite(msg.payload)
        break
      }
      default:
        this.logger.warn('Unknown message type', { message })
    }
  }

  private vmenv_handleCmdExit(payload: rws.RunningEnvironment_CmdExit['payload']) {
    if (payload.error === undefined) return
    this.opts.onCmdOut?.({
      environmentID: payload.environmentID,
      executionID: payload.executionID,
      stderr: payload.error,
    })
  }

  private vmenv_handleFSEventWrite(payload: rws.RunningEnvironment_FSEventWrite['payload']) {
    this.logger.log('[vmenv] Handling "FSEventWrite"', payload)
    const env = this.envs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger.warn('Environment not found', { payload })
      return
    }
    this.fsWriteSubscribers.forEach(s => s(payload))
  }

  private vmenv_handleStartAck(payload: rws.RunningEnvironment_StartAck['payload']) {
    this.logger.log('[vmenv] Handling "StartAck"', { payload })
    const env = this.envs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger.warn('Environment not found', { payload })
      return
    }
    env.isReady = true
    this.opts.onEnvChange?.(env)
  }

  private vmenv_handleCmdOut(payload: rws.RunningEnvironment_CmdOut['payload']) {
    this.logger.log('[vmenv] Handling "CmdOut"', payload)
    this.opts.onCmdOut?.(payload)
  }
}

export default EvaluationContext
