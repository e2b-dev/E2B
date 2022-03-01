import Logger from '../utils/Logger'
import { WebSocketConnection } from './webSocketConnection'
import SessionManager from './session/sessionManager'
import EvaluationContext, {
  EvaluationContextOpts,
} from './evaluationContext'
import { Config } from './devbook'

class Runner {
  private logger = new Logger('Runner')

  static config: Config

  private static _obj: Runner
  static get obj() {
    if (!Runner.config) throw new Error('Config not set')
    return Runner._obj || (Runner._obj = new Runner())
  }

  private readonly conn = new WebSocketConnection({ domain: Runner.config.domain })

  private readonly sessManager = new SessionManager({
    conn: this.conn,
    domain: Runner.config.domain,
  })

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

  /* ==== Debug Methods ==== */
  __debug__loadNewSession() {
    this.logger.log('__debug__loadNewSession')
    this.sessManager.reset()
  }
}

export default Runner
