// This Node builtin is polyfilled with Rollup
import path from 'path'

import * as rws from '../common-ts/RunnerWebSocket'
import { WebSocketConnection } from './webSocketConnection'
import Logger from '../utils/Logger'
import {
  Env,
  templates,
} from './constants'
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
  onSessionChange?: (session: { status: SessionStatus, sessionID?: string }) => void
  onEnvChange?: (env: RunningEnvironment) => void
}

type FSWriteSubscriber = (payload: rws.RunningEnvironment_FSEventWrite['payload']) => void
type FileContentSubscriber = (payload: rws.RunningEnvironment_FileContent['payload']) => void

class EvaluationContext {
  private readonly logger: Logger

  private get contextID() {
    return this.opts.contextID
  }

  private fsWriteSubscribers: FSWriteSubscriber[] = []
  private fileContentSubscribers: FileContentSubscriber[] = []

  private envs: RunningEnvironment[] = []
  private readonly unsubscribeConnHandler: () => void

  constructor(private readonly opts: EvaluationContextOpts) {
    this.logger = new Logger('EvaluationContext', opts.debug)

    this.unsubscribeConnHandler = this.opts.conn.subscribeHandler({
      onOpen: this.handleConnectionOpen.bind(this),
      onMessage: this.handleConnectionMessage.bind(this),
      onClose: this.handleConnectionClose.bind(this),
    })

    if (this.opts.conn.isOpen && this.opts.conn.sessionID) {
      this.handleConnectionOpen(this.opts.conn.sessionID)
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
      env.restart()
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
    this.fileContentSubscribers = []
  }

  async getFile({ templateID, path: filepath }: { templateID: Env, path: string }) {
    this.logger.log('Get file', { templateID, filepath })
    const env = this.getRunningEnvironment({ templateID })
    if (!env) {
      this.logger.error('Environment not found', { templateID, filepath })
      return
    }
    if (!env.isReady) {
      this.logger.error('Environment is not ready', { templateID, filepath })
      return
    }

    let resolveFileContent: (content: string) => void
    const fileContent = new Promise<string>((resolve, reject) => {
      resolveFileContent = resolve
      setTimeout(() => {
        reject('Timeout')
      }, 10000)
    })

    const fileContentSubscriber: FileContentSubscriber = (payload) => {
      if (!payload.path.endsWith(filepath)) return
      resolveFileContent(payload.content)
    }
    this.subscribeFileContent(fileContentSubscriber)

    envWS.getFile(this.opts.conn, {
      path: filepath,
      environmentID: env.id,
    })

    try {
      const content = await fileContent
      return content
    } catch (err: any) {
      throw new Error(`Error retrieving file ${filepath}: ${err}`)
    } finally {
      this.unsubscribeFileContent(fileContentSubscriber)
    }
  }

  async updateFile({ templateID, path: filepath, content }: { templateID: Env, path: string, content: string }) {
    this.logger.log('Update file', { templateID, filepath })
    const env = this.getRunningEnvironment({ templateID })
    if (!env) {
      this.logger.error('Environment not found', { templateID, filepath })
      return
    }
    if (!env.isReady) {
      this.logger.error('Environment is not ready', { templateID, filepath })
      return
    }

    let resolveFileWritten: (value: void) => void
    const fileWritten = new Promise<void>((resolve, reject) => {
      resolveFileWritten = resolve
      setTimeout(() => {
        reject('Timeout')
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
      content,
    })

    try {
      await fileWritten
    } catch (err: any) {
      throw new Error(`File ${filepath} not written to VM: ${err}`)
    } finally {
      this.unsubscribeFSWrite(fsWriteSubscriber)
    }
  }

  async executeCode({ templateID, executionID, code }: { templateID: Env, executionID: string, code: string }) {
    this.logger.log('Execute code', { templateID, executionID })
    const toCommand = templates[templateID].toCommand

    if (toCommand === undefined) return

    const env = this.getRunningEnvironment({ templateID })
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

    envWS.writeFile(this.opts.conn, {
      environmentID: env.id,
      path: filepath,
      content: code,
    })

    // Send command to execute file as code
    const vmFilepath = path.join(templates[templateID].root_dir, filepath)
    const command = toCommand(vmFilepath)
    envWS.execCmd(this.opts.conn, {
      environmentID: env.id,
      executionID,
      command,
    })
  }

  executeCommand({ templateID, executionID, command }: { templateID: Env, executionID: string, command: string }) {
    this.logger.log('Execute shell command', { templateID, executionID, command })

    const env = this.getRunningEnvironment({ templateID })
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

  getRunningEnvironment({ templateID }: { templateID: Env }) {
    return this.envs.find(e => e.templateID === templateID)
  }

  createRunningEnvironment({ templateID }: { templateID: Env }) {
    this.logger.log('Creating running environment', { templateID })

    const existingEnv = this.getRunningEnvironment({ templateID })
    if (existingEnv) return

    const env = new RunningEnvironment(this.contextID, templateID)
    this.envs.push(env)
    envWS.start(this.opts.conn, {
      environmentID: env.id,
      template: env.template,
    })
    this.opts.onEnvChange?.(env)
  }

  deleteEnvFile(args: { envID: string; path: string }) {
    this.logger.log('Delete file in env fs', args)
    envFS.ws.deleteFile(this.opts.conn, {
      envID: args.envID,
      path: args.path,
    })
  }

  updateFile({ envID, documentEnvID, path, content }: { envID: string, documentEnvID: string, path: string, content: string }) {
    this.logger.log('Update document or vm file', { documentEnvID, path })
    const file = this.files.find(f => f.documentEnvID === documentEnvID && f.path === path)
    if (file) {
      this.opts.collabHandlers.file.upsert({ id: file.id, path, documentEnvID, content })
      return
    }
    envFS.ws.writeFile(this.opts.conn, {
      envID,
      path,
      content,
    })
  }

  listEnvDir(args: { envID: string, path: string }) {
    this.logger.log('List dir from env fs', args)
    envFS.ws.listDir(this.opts.conn, {
      envID: args.envID,
      path: args.path,
    })
  }

  private subscribeFileContent(subscriber: FileContentSubscriber) {
    this.fileContentSubscribers.push(subscriber)
  }

  private unsubscribeFileContent(subscriber: FileContentSubscriber) {
    const index = this.fileContentSubscribers.indexOf(subscriber)
    if (index > -1) {
      this.fileContentSubscribers.splice(index, 1);
    }
  }

  private subscribeFSWrite(subscriber: FSWriteSubscriber) {
    this.fsWriteSubscribers.push(subscriber)
  }

  private unsubscribeFSWrite(subscriber: FSWriteSubscriber) {
    const index = this.fsWriteSubscribers.indexOf(subscriber)
    if (index > -1) {
      this.fsWriteSubscribers.splice(index, 1);
    }
  }

  private handleConnectionOpen(sessionID: string) {
    this.restart()
    this.opts.onSessionChange?.({ status: SessionStatus.Connected, sessionID })
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
      case rws.MessageType.RunningEnvironment.FileContent: {
        const msg = message as rws.RunningEnvironment_FileContent
        this.vmenv_handleFileContent(msg.payload)
        break
      }

      case rws.MessageType.RunningEnvironment.FSEventCreate: {
        const msg = message as rws.RunningEnvironment_FSEventCreate
        this.vmenv_handleFSEventCreate(msg.payload)
        break
      }
      case rws.MessageType.RunningEnvironment.FSEventRemove: {
        const msg = message as rws.RunningEnvironment_FSEventRemove
        this.vmenv_handleFSEventRemove(msg.payload)
        break
      }
      case rws.MessageType.RunningEnvironment.DirContent: {
        const msg = message as rws.RunningEnvironment_DirContent
        this.vmenv_handleDirContent(msg.payload)
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

  private vmenv_handleFileContent(payload: rws.RunningEnvironment_FileContent['payload']) {
    this.logger.log('[vmenv] Handling "FileContent"', { environmentID: payload.environmentID, path: payload.path })
    const env = this.envs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger.warn('Environment not found', { payload })
      return
    }
    this.fileContentSubscribers.forEach(s => s(payload))
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
