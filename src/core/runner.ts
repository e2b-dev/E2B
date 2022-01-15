import Logger from '../utils/Logger'
import { WebSocketConnection } from './webSocketConnection'
import SessionManager from './session/sessionManager'
import DocumentContext, { DocumentContextOpts } from './documentContext/documentContext'
import { template } from './constants'

class Runner {
  private logger = new Logger('Runner')

  private static _obj: Runner
  static get obj() {
    if (typeof window === 'undefined') return
    return Runner._obj || (Runner._obj = new Runner())
  }
  private readonly conn = new WebSocketConnection()

  private readonly sessManager = new SessionManager(this.conn)
  get session() {
    return this.sessManager.session
  }
  get status() {
    return this.sessManager.status
  }
  get codeCells() {
    return this.documentContext?.codeCells
  }
  get runningEnvs() {
    return this.documentContext?.runningEnvs
  }

  documentContext?: DocumentContext = undefined

  /**
   * Close current session and destroy current `DocumentContext`. The session manager will try to get a new session.
   */
  reset() {
    this.logger.log('Reset')
    this.documentContext = undefined
    this.sessManager.reset()
  }

  initializeDocumentContext(opts: Omit<DocumentContextOpts, 'conn'>) {
    this.documentContext?.destroy()
    const context = new DocumentContext({
      ...opts,
      conn: this.conn,
    })
    this.documentContext = context
    return context
  }

  destroyDocumentContext() {
    this.documentContext?.destroy()
    this.documentContext = undefined
  }

  private getDocumentEnvID({ envID }: { envID: string }) {
    const env = this.documentContext?.findRunningEnv({ envID })
    if (!env) {
      this.logger.log(`Cannot find running environment for id "${envID}"`)
      return
    }
    return env.documentEnvID
  }

  /* ==== Shell Code Cell === */
  createShellCodeCell(opts: {
    documentEnvID?: string,
    templateID: template.TemplateID,
  }) {
    return this.documentContext?.createShellCodeCell(opts)
  }

  execShellCodeCell({ documentEnvID, execID, command }: { documentEnvID: string, execID: string, command: string }) {
    return this.documentContext?.execShellCodeCell({ documentEnvID, execID, command })
  }
  /* ======== */

  /* ==== Code Cells ==== */
  createCodeCell(opts: {
    id?: string,
    name?: string,
    initialCode?: string,
    documentEnvID?: string,
    templateID: template.TemplateID,
  }) {
    return this.documentContext?.createCodeCell(opts)
  }

  deleteCodeCell(id: string) {
    this.documentContext?.deleteCodeCell(id)
  }

  updateCodeCellCode(id: string, code: string) {
    this.documentContext?.updateCodeCellCode(id, code)
  }

  updateCodeCellTemplateID(id: string, templateID: template.TemplateID) {
    this.documentContext?.updateCodeCellTemplateID(id, templateID)
  }

  updateCodeCellDocumentEnvID(id: string, documentEnvID: string) {
    this.documentContext?.updateCodeCellDocumentEnvID(id, documentEnvID)
  }

  updateCodeCellName(id: string, name: string) {
    this.documentContext?.updateCodeCellName(id, name)
  }
  /* ======== */

  /* ==== Debug Methods ==== */
  /**
   * Close current session, get a new one and then restart all `RunningEnvironment` in the `DocumentContext`.
   * This function works almost like calling `.reset` but it keeps the `DocumentContext` for the current document.
   */
  __debug__loadNewSession() {
    this.logger.log('__debug__loadNewSession')
    this.sessManager.reset()
  }

  /**
   * Delete all document's environments that are shared with collab.
   * If you want to recreate default environments from code cells you need to reload the page with the document.
   */
  __debug__deleteDocumentEnvironments() {
    this.logger.log('__debug_deleteDocumentEnvironments')
    this.documentContext?.runningEnvs.forEach(env => {
      this.documentContext?.deleteDocumentEnvironment({ id: env.documentEnvID })
    })
  }
}

export default Runner
