import Logger from '../utils/Logger'
import { WebSocketConnection } from './webSocketConnection'
import SessionManager from './session/sessionManager'
import DocumentContext, { DocumentContextOpts } from './documentContext/documentContext'

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

  /**
   * Close current session and destroy current `DocumentContext`. The session manager will try to get a new session.
   */
  reset() {
    this.logger.log('Reset')
    this.sessManager.reset()
  }

  initializeDocumentContext(opts: Omit<DocumentContextOpts, 'conn'>) {
    return new DocumentContext({
      ...opts,
      conn: this.conn,
    })
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
}

export default Runner
