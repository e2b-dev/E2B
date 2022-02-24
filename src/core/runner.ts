import Logger from '../utils/Logger'
import { WebSocketConnection } from './webSocketConnection'
import SessionManager from './session/sessionManager'
import EvaluationContext, {
  EvaluationContextOpts,
} from './evaluationContext'

class Runner {
  private logger = new Logger('Runner')

  private static _obj: Runner
  static get obj() {
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
   * Close current session. The session manager will try to get a new session.
   */
  reset() {
    this.logger.log('Reset')
    this.sessManager.reset()
  }

  createContext(opts: Omit<EvaluationContextOpts, 'conn'>) {
    return new EvaluationContext({
      ...opts,
      conn: this.conn,
    })
  }

  /** @internal */
  __internal__start() {
    this.sessManager.start()
  }

  /** @internal */
  __internal__stop() {
    this.sessManager.stop()
  }

  /* ==== Debug Methods ==== */
  __debug__loadNewSession() {
    this.logger.log('__debug__loadNewSession')
    this.sessManager.reset()
  }
}

export default Runner
