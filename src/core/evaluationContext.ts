// This Node builtin is polyfilled with Rollup
import path from 'path'

import * as rws from '../common-ts/RunnerWebSocket'
import { WebSocketConnection } from './webSocketConnection'
import Logger from '../utils/Logger'
import {
  RunningEnvironment,
  ws as envWS,
} from './runningEnvironment'
import { SessionStatus } from './session/sessionManager'
import { FSNodeType } from './runningEnvironment/filesystem'
import { OutputSource } from './runningEnvironment/runningEnvironment'
import { Env } from './devbook'

export interface EvaluationContextOpts {
  contextID: string
  templateID: Env
  debug?: boolean
  conn: WebSocketConnection
  onCmdOut?: (payload: rws.RunningEnvironment_CmdOut['payload']) => void
  onSessionChange?: (session: { status: SessionStatus }) => void
  onEnvChange?: (env: RunningEnvironment) => void
}

type FSWriteSubscriber = (payload: rws.RunningEnvironment_FSEventWrite['payload']) => void
type FileContentSubscriber = (payload: rws.RunningEnvironment_FileContent['payload']) => void
type TerminalDataSubscriber = (payload: rws.RunningEnvironment_TermData['payload']) => void

class EvaluationContext {
  private readonly logger: Logger

  private get contextID() {
    return this.opts.contextID
  }

  private fsWriteSubscribers: FSWriteSubscriber[] = []
  private fileContentSubscribers: FileContentSubscriber[] = []
  private termDataSubscribers: TerminalDataSubscriber[] = []

  readonly env: RunningEnvironment
  private readonly unsubscribeConnHandler: () => void

  constructor(private readonly opts: EvaluationContextOpts) {
    this.logger = new Logger(`EvaluationContext [${opts.templateID}]`, opts.debug)
    this.env = new RunningEnvironment(this.contextID, opts.templateID)

    const onOpen = () => this.handleConnectionOpen()
    const onMessage = (msg: rws.BaseMessage) => this.handleConnectionMessage(msg)
    const onClose = () => this.handleConnectionClose()

    this.unsubscribeConnHandler = this.opts.conn.subscribeHandler({
      onOpen,
      onMessage,
      onClose,
    })

    if (this.opts.conn.isOpen) {
      this.handleConnectionOpen()
    }
    if (this.opts.conn.isClosed) {
      this.handleConnectionClose()
    }

    envWS.start(this.opts.conn, {
      environmentID: this.env.id,
      templateID: this.env.templateID,
    })
    this.opts.onEnvChange?.(this.env)
  }

  /**
   * Restarts all context's objects to their default state.
   * This method should be called only after the new WS connection is estabilished.
   */
  restart() {
    this.logger.log('Restart', this.opts.conn.sessionID)
    this.env.restart()
    envWS.start(this.opts.conn, {
      environmentID: this.env.id,
      templateID: this.env.templateID,
    })
  }

  destroy() {
    this.logger.log('Destroy')
    this.unsubscribeConnHandler()
    this.fsWriteSubscribers = []
    this.fileContentSubscribers = []
  }

  async getFile({ path: filepath }: { path: string }) {
    this.logger.log('Get file', { filepath })

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
      environmentID: this.env.id,
      path: filepath,
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

  deleteFile({ path: filepath }: { path: string }) {
    this.logger.log('Delete file', { filepath })

    envWS.deleteFile(this.opts.conn, {
      environmentID: this.env.id,
      path: filepath,
    })
  }

  async updateFile({ path: filepath, content }: { path: string, content: string }) {
    this.logger.log('Update file', { filepath })

    let resolveFileWritten: () => void
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
      environmentID: this.env.id,
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

  createDir({ path: filepath }: { path: string }) {
    this.logger.log('Create dir', { filepath })

    envWS.createDir(this.opts.conn, {
      environmentID: this.env.id,
      path: filepath,
    })
  }

  listDir({ path: filepath }: { path: string }) {
    this.logger.log('List dir', { filepath })

    envWS.listDir(this.opts.conn, {
      environmentID: this.env.id,
      path: filepath,
    })
  }

  executeCommand({ executionID, command }: { executionID: string, command: string }) {
    this.logger.log('Execute shell command', { executionID, command })
    envWS.execCmd(this.opts.conn, {
      environmentID: this.env.id,
      executionID,
      command,
    })
  }

  resizeTerminal({ terminalID, cols, rows }: { terminalID: string, cols: number, rows: number }) {
    envWS.terminalResize(this.opts.conn, {
      environmentID: this.env.id,
      terminalID,
      cols,
      rows,
    })
  }

  sendTerminalData({ terminalID, data }: { terminalID: string, data: string }) {
    envWS.terminalData(this.opts.conn, {
      environmentID: this.env.id,
      terminalID,
      data,
    })
  }

  onTerminalData({ terminalID, onData }: { terminalID: string, onData: (data: string) => void }) {
    const subscriber: TerminalDataSubscriber = (payload) => {
      if (payload.terminalID !== terminalID) return
      onData(payload.data)
    }

    this.subscribeTermData(subscriber)
    return () => this.unsubscribeTermData(subscriber)
  }

  private subscribeTermData(subscriber: TerminalDataSubscriber) {
    this.termDataSubscribers.push(subscriber)
  }

  private unsubscribeTermData(subscriber: TerminalDataSubscriber) {
    const index = this.termDataSubscribers.indexOf(subscriber)
    if (index > -1) {
      this.termDataSubscribers.splice(index, 1);
    }
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

  private handleConnectionOpen() {
    this.restart()
    this.opts.onSessionChange?.({ status: SessionStatus.Connecting })
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
      case rws.MessageType.RunningEnvironment.Stderr: {
        const msg = message as rws.RunningEnvironment_Stderr
        this.vmenv_handleStderr(msg.payload)
        break
      }
      case rws.MessageType.RunningEnvironment.Stdout: {
        const msg = message as rws.RunningEnvironment_Stdout
        this.vmenv_handleStdout(msg.payload)
        break
      }
      case rws.MessageType.RunningEnvironment.TermData: {
        const msg = message as rws.RunningEnvironment_TermData
        this.vmenv_handleTermData(msg.payload)
        break
      }
      default:
        this.logger.warn('Unknown message type', { message })
    }
  }

  private vmenv_handleTermData(payload: rws.RunningEnvironment_TermData['payload']) {
    this.logger.log('[vmenv] Handling "SSHData"', payload)
    this.termDataSubscribers.forEach(s => s(payload))
  }

  private vmenv_handleFSEventCreate(payload: rws.RunningEnvironment_FSEventCreate['payload']) {
    this.logger.log('[vmenv] Handling "FSEventCreate"', payload)

    const basename = path.basename(payload.path)
    const dirPath = path.dirname(payload.path)

    const type = payload.type === 'Directory' ? 'Dir' : 'File'
    this.env.filesystem.addNodeToDir(
      dirPath,
      { name: basename, type },
    )
  }

  private vmenv_handleFSEventRemove(payload: rws.RunningEnvironment_FSEventRemove['payload']) {
    this.logger.log('[vmenv] Handling "FSEventRemove"', { payload })

    const basename = path.basename(payload.path)
    const dirPath = path.dirname(payload.path)
    this.env.filesystem.removeNodeFromDir(
      dirPath,
      { name: basename },
    )
  }

  private vmenv_handleDirContent(payload: rws.RunningEnvironment_DirContent['payload']) {
    this.logger.log('[vmenv] Handling "DirContent"', payload)

    const content: { name: string, type: FSNodeType }[] = []
    for (const item of payload.content) {
      const basename = path.basename(item.path)
      const type: FSNodeType = item.type === 'Directory' ? 'Dir' : 'File'
      content.push({ name: basename, type })
    }

    this.env.filesystem.setDirsContent([{ dirPath: payload.dirPath, content }])
  }

  private vmenv_handleCmdExit(payload: rws.RunningEnvironment_CmdExit['payload']) {
    this.logger.log('[vmenv] Handling "CmdExit"', payload)

    if (payload.error === undefined) return
    this.opts.onCmdOut?.({
      environmentID: payload.environmentID,
      executionID: payload.executionID,
      stderr: payload.error,
    })
  }

  private vmenv_handleFSEventWrite(payload: rws.RunningEnvironment_FSEventWrite['payload']) {
    this.logger.log('[vmenv] Handling "FSEventWrite"', payload)

    this.fsWriteSubscribers.forEach(s => s(payload))
  }

  private vmenv_handleFileContent(payload: rws.RunningEnvironment_FileContent['payload']) {
    this.logger.log('[vmenv] Handling "FileContent"', { environmentID: payload.environmentID, path: payload.path })

    this.fileContentSubscribers.forEach(s => s(payload))
  }

  private vmenv_handleStartAck(payload: rws.RunningEnvironment_StartAck['payload']) {
    this.logger.log('[vmenv] Handling "StartAck"', { payload })

    this.env.isReady = true
    this.opts.onEnvChange?.(this.env)
    this.opts.onSessionChange?.({ status: SessionStatus.Connected })
  }

  private vmenv_handleCmdOut(payload: rws.RunningEnvironment_CmdOut['payload']) {
    this.logger.log('[vmenv] Handling "CmdOut"', payload)

    this.opts.onCmdOut?.(payload)
  }

  private vmenv_handleStderr(payload: rws.RunningEnvironment_Stderr['payload']) {
    this.logger.log('[vmenv] Handling "Stderr"', payload)

    this.env.logOutput(payload.message, OutputSource.Stderr)
  }

  private vmenv_handleStdout(payload: rws.RunningEnvironment_Stdout['payload']) {
    this.logger.log('[vmenv] Handling "Stdout"', payload)

    this.env.logOutput(payload.message, OutputSource.Stdout)
  }
}

export default EvaluationContext
