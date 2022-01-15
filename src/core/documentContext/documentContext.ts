import * as rws from '../../common-ts/RunnerWebSocket'
import { WebSocketConnection } from '../webSocketConnection'
import { makeIDGenerator } from '../../utils/id'
import Logger from '../../utils/Logger'

import { EnvironmentCodeCell } from './codeCell'
import {
  DocumentEnvironment,
  RunningEnvironment,
  ws as envWS,
} from './runningEnvironment'
import { OutputSource } from './runningEnvironment/runningEnvironment'
import hash from '../../utils/hash'
import { templates, Template } from '../constants'

export const generateCodeCellID = makeIDGenerator(8)
const generateFileSufix = makeIDGenerator(3)

export function getDefaultDocumentEnvID(templateID: Template) {
  return hash(templateID)
}

export interface UpsertDocumentEnvironment extends DocumentEnvironment {
  documentID: string
}
export interface DeleteDocumentEnvironment extends Pick<DocumentEnvironment, 'id'> { }

export interface DocumentContextOpts {
  documentID: string
  conn: WebSocketConnection
  onStdout?: (stdout: string) => any
  onStderr?: (stderr: string) => any
  onCmdOut?: (out: { stdout: string | null, stderr: string | null }) => any
  onURLChange?: (url: string) => any
}

class DocumentContext {
  private logger = new Logger('DocumentContext')

  get documentID() {
    return this.opts.documentID
  }

  runningEnvs: RunningEnvironment[] = []
  codeCells: EnvironmentCodeCell[] = []

  constructor(private readonly opts: DocumentContextOpts) {
    this.opts.conn.onOpen = this.restart.bind(this)
    this.opts.conn.onMessage = this.handleConnectionMessage.bind(this)
  }

  /**
   * Restarts all context's objects to their default state.
   * This method should be called only after the new WS connection is estabilished.
   * This method should restart/call restart method on all objects in context.
   */
  restart() {
    this.logger.log('Restart - session:', this.opts.conn.sessionID)
    return Promise.all(this.runningEnvs.map(env => {
      env.restart()
      envWS.start(this.opts.conn, {
        envID: env.id,
        template: env.template,
      })
    }))
  }

  destroy() {
    this.logger.log('Destroy')
    this.runningEnvs = []
    this.codeCells = []
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
      default:
        this.logger.warn('Unknown message type', { message })
    }
  }

  /* ENVIRONMENTS */

  deleteDocumentEnvironment(event: DeleteDocumentEnvironment) {
    this.logger.log('[collab] Handling "DeleteDocumentEnvironment"', { event })
    this.runningEnvs = this.runningEnvs.filter(env => env.documentEnvID !== event.id)
    this.codeCells
      .filter(cc => cc.documentEnvID === event.id)
      .forEach(cc => {
        cc.documentEnvID = undefined
      })
  }

  addDocumentEnvironment(event: UpsertDocumentEnvironment) {
    this.logger.log('[collab] Handling "AddDocumentEnvironment"', { event })
    const wasEnvCreated = !!this.runningEnvs.find(e => e.id === event.id)
    if (wasEnvCreated) return

    const env = new RunningEnvironment(this.documentID, event)
    this.runningEnvs = [
      ...this.runningEnvs,
      env,
    ]
    envWS.start(this.opts.conn, {
      envID: env.id,
      template: env.template,
    })
  }

  vmenv_handleStartAck(payload: rws.RunningEnvironment_StartAck['payload']) {
    this.logger.log('[vmenv] Handling "StartAck"', { payload })
    const env = this.runningEnvs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger.warn('Environment not found', { payload })
      return
    }
    env.isReady = true
    return this.evaluateEnvironment(env.documentEnvID)
  }

  vmenv_handleStderr(payload: rws.RunningEnvironment_Stderr['payload']) {
    this.logger.log('[vmenv] Handling "Stderr"', payload)
    const env = this.runningEnvs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger.warn('Environment not found', { payload })
      return
    }
    env.logOutput(payload.message, OutputSource.Stderr)
    this.opts.onStderr?.(payload.message)
  }

  vmenv_handleStdout(payload: rws.RunningEnvironment_Stdout['payload']) {
    this.logger.log('[vmenv] Handling "Stdout"', payload)
    const env = this.runningEnvs.find(e => e.id === payload.environmentID)
    if (!env) {
      this.logger.warn('Environment not found', { payload })
      return
    }
    env.logOutput(payload.message, OutputSource.Stdout)
    this.opts.onStdout?.(payload.message)
  }

  vmenv_handleCmdOut(payload: rws.RunningEnvironment_CmdOut['payload']) {
    this.logger.log('[vmenv] Handling "CmdOut"', payload)
    const out = {
      documentID: this.documentID,
      output: {
        stdout: payload.stdout ?? null,
        stderr: payload.stderr ?? null,
        executionID: payload.executionID,
      },
    }
    this.opts.onCmdOut?.(out.output)
  }

  findRunningEnv({ envID }: { envID: string }) {
    return this.runningEnvs.find(env => env.id === envID)
  }

  private findDocumentEnvironment({ documentEnvID }: { documentEnvID: string }) {
    return this.runningEnvs.find(env => env.documentEnvID === documentEnvID)
  }

  private async evaluateEnvironment(documentEnvID: string) {
    this.logger.log('Evaluate environment', { documentEnvID })
    const env = this.findDocumentEnvironment({ documentEnvID })

    if (!env) {
      this.logger.warn('Environment not found', { documentEnvID })
      return
    }
    if (!env.isReady) {
      this.logger.warn('Environment not ready', { documentEnvID, env })
      return
    }

    const codeCells = this.codeCells.filter(cc => cc.documentEnvID === env.documentEnvID)

    if (!codeCells.length) return

    const ccs = codeCells.map(cc => ({
      id: cc.id,
      state: [],
      name: cc.name,
      templateID: env.template.id,
      code: cc.code,
    }))
    env.debounceFunction(() => envWS.evaluate(this.opts.conn, {
      envID: env.id,
      codeCells: ccs,
    }))
  }

  /* === SHELL CODE CELLS === */
  createShellCodeCell(args: {
    documentEnvID?: string,
    templateID: Template,
  }) {
    this.logger.log('Create shell code cell', args)

    const {
      templateID,
      documentEnvID,
    } = args

    const defaultDocumentEnvID = documentEnvID || getDefaultDocumentEnvID(templateID as Template)
    let env = this.findDocumentEnvironment({ documentEnvID: defaultDocumentEnvID })
    if (env) return env.documentEnvID

    // There isn't any environment for the specified template. Let's create a new one.
    this.addDocumentEnvironment({
      documentID: this.documentID,
      templateID,
      id: defaultDocumentEnvID,
    })
    return defaultDocumentEnvID
  }

  execShellCodeCell(args: { documentEnvID: string, execID: string, command: string }) {
    this.logger.log('Exec shell code cell', args)

    const env = this.findDocumentEnvironment({ documentEnvID: args.documentEnvID })
    if (!env) {
      // This shouldn't ever happened since we were
      // supposed to call the `createShellCodeCell` method on init.
      this.logger.error('Environment not found', { args })
      return
    }

    envWS.execCmd(this.opts.conn, {
      envID: env.id,
      execID: args.execID,
      command: args.command,
    })
  }
  /* ====== */

  /* === CODE CELLS === */
  updateCodeCellCode(id: string, code: string) {
    this.logger.log('Update code cell code', { id, code })
    const cc = this.findCodeCell(id)
    if (!cc) {
      this.logger.warn('Code cell not found', { id, code })
      return
    }

    cc.code = code
    if (cc.documentEnvID) this.evaluateEnvironment(cc.documentEnvID)
  }

  updateCodeCellName(id: string, name: string) {
    this.logger.log('Update code cell name', { id, name })
    const cc = this.findCodeCell(id)
    if (!cc) {
      this.logger.warn('Code cell not found', { id, name })
      return
    }

    // TODO: Ugly and hackish.
    const splits = name.split('.')
    const basename = splits.length > 0 ? splits[0] : 'cc'
    let ext = splits.length > 1 ? splits.pop() : ''
    cc.name = this.createUniqueCellName(basename, ext || 'MISSING')
    if (cc.documentEnvID) this.evaluateEnvironment(cc.documentEnvID)
  }

  updateCodeCellDocumentEnvID(id: string, documentEnvID: string) {
    this.logger.log('Update code cell document env ID', { id, documentEnvID })
    const cc = this.findCodeCell(id)
    if (!cc) {
      this.logger.warn('Code cell not found', { id, documentEnvID })
      return
    }

    cc.documentEnvID = documentEnvID

    const env = this.findDocumentEnvironment({ documentEnvID })
    if (!env) {
      this.addDocumentEnvironment({
        documentID: this.documentID,
        templateID: cc.templateID,
        id: getDefaultDocumentEnvID(cc.templateID)
      })
    } else {
      this.evaluateEnvironment(documentEnvID)
    }
  }

  updateCodeCellTemplateID(id: string, templateID: Template) {
    this.logger.log('Update code cell template ID', { id, templateID })
    const cc = this.findCodeCell(id)
    if (!cc) {
      this.logger.warn('Code cell not found', { id, templateID })
      return
    }

    const documentEnvID = getDefaultDocumentEnvID(templateID)

    cc.templateID = templateID
    cc.documentEnvID = documentEnvID

    const env = this.findDocumentEnvironment({ documentEnvID })
    if (!env) {
      this.addDocumentEnvironment({
        documentID: this.documentID,
        templateID: templateID,
        id: documentEnvID,
      })
    } else if (cc.documentEnvID) {
      this.evaluateEnvironment(cc.documentEnvID)
    }
  }

  deleteCodeCell(id: string) {
    this.logger.log('Delete code cell', { id })
    this.codeCells = this.codeCells.filter(cc => cc.id !== id)
  }

  createCodeCell(args: {
    id?: string,
    name?: string,
    initialCode?: string,
    documentEnvID?: string,
    templateID: Template,
  }) {
    this.logger.log('Creating code cell', { ...args })
    const {
      id = generateCodeCellID(),
      name,
      initialCode,
      templateID,
      documentEnvID,
    } = args

    const existingCodeCell = this.findCodeCell(id)
    if (existingCodeCell) return existingCodeCell

    const defaultDocumentEnvID = documentEnvID || getDefaultDocumentEnvID(templateID)
    let env = this.findDocumentEnvironment({ documentEnvID: defaultDocumentEnvID })

    // // For now we put all code cells with the same template in the same environment.
    if (!env) {
      // There isn't any environment for the specified template. Let's create a new one.
      this.addDocumentEnvironment({
        documentID: this.documentID,
        templateID,
        id: defaultDocumentEnvID,
      })
    }

    const splits = name?.split('.') || []
    const basename = splits.length > 0 ? splits[0] : 'cc'
    let ext = splits.length > 1 ? splits.pop() : ''
    if (!ext) {
      switch (templateID) {
        case 'nextjs-v11-components':
          ext = 'tsx'
          break
        case 'nodejs-v16':
          ext = 'js'
          break
        default:
          ext = 'TODO'
          break
      }
    }
    const uniqueName = this.createUniqueCellName(basename, ext)
    const codeCell = new EnvironmentCodeCell({
      id,
      name: uniqueName,
      code: initialCode,
      templateID: env?.template.id as Template || templateID,
      documentEnvID: defaultDocumentEnvID,
    })
    this.codeCells.push(codeCell)
    this.logger.log('Created code cell', { ...args, id, inEnv: env, runningEnvs: this.runningEnvs })
    return codeCell
  }

  private createUniqueCellName(name: string, ext: string): string {
    const fullName = `${name}.${ext}`
    const isUnique = !this.codeCells.find(cc => cc.name === fullName)
    if (isUnique) return fullName
    return `${name}-${generateFileSufix()}.${ext}`
  }

  private findCodeCell(id: string) {
    return this.codeCells.find(cc => cc.id === id)
  }
  /* ====== */
}

export default DocumentContext
