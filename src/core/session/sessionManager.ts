import wait from '../../utils/wait'
import Logger from '../../utils/Logger'
import { runner as consts } from '../constants'
import { WebSocketConnection } from '../webSocketConnection'
import RunnerSession from './runnerSession'

export enum SessionStatus {
  Connected = 'Connected',
  Connecting = 'Connecting',
  Disconnected = 'Disconnected',
}

interface GetSessionResponse {
  sessionID: string
}

class SessionManager {
  private readonly logger = new Logger('SessionManager')
  private readonly url = `https://${consts.REMOTE_RUNNER_HOSTNAME}`

  private isGettingSessionActive = false

  // Session storage is unique for each tab. We use it so each tab has its own VM = session.
  private get cachedSessionID() {
    return sessionStorage.getItem(consts.STORAGE_SESSION_ID_KEY)
  }
  private set cachedSessionID(sessionID: string | null) {
    if (sessionID === null) {
      this.logger.log('Cleared last sessionID')
      sessionStorage.removeItem(consts.STORAGE_SESSION_ID_KEY)
    } else {
      this.logger.log(`Saved sessionID "${sessionID}" as last sessionID`)
      sessionStorage.setItem(consts.STORAGE_SESSION_ID_KEY, sessionID)
    }
  }

  session?: RunnerSession
  status = SessionStatus.Disconnected

  constructor(
    private readonly conn: WebSocketConnection
  ) {
    this.logger.log('Initialize')
    this.getSession()
  }

  reset() {
    this.logger.log('Reset')
    this.status = SessionStatus.Disconnected
    this.cachedSessionID = null
    this.conn.close()
    this.session = undefined
  }

  /**
   * Tries to connect back to a session with the cached session ID.
   * If no such session exists, a new session will be created and we will receive a new session ID that will be cached.
   *
   * If it fails, it will automatically keep trying again after 10s pause until the session is successfully acquired.
   */
  private async getSession() {
    if (this.isGettingSessionActive) return
    this.isGettingSessionActive = true

    // There should be only one `getSession` loop active in the whole app.
    // It keeps acquiring session and keeping the acquired session alive.

    // The outer while loop is to keep trying until we get a session.
    // The inner while loop is to keep pinging just acquired session.
    while (true) {
      this.status = SessionStatus.Connecting
      try {
        const url = this.cachedSessionID
          ? `${this.url}/session/${this.cachedSessionID}`
          : `${this.url}/session`

        if (this.cachedSessionID) {
          this.logger.log(`Restoring old Runner session "${this.cachedSessionID}"`)
        } else {
          this.logger.log('Acquiring new Runner session')
        }

        const resp = await fetch(url)
        // The response contains an ID of the just assigne session. This ID is used
        // for the WebSocket communication with the assigned FC machine.
        //
        // Send the last sessionID with the request if we have it stored.
        // This way we "ask" the server to either give us the old session (if
        // it still exists on the server) or assign us a new one.
        // Either way, we get the ID of the active session in a response.
        const sessionResp: GetSessionResponse = await resp.json()

        // HTTP code >299
        if (!resp.ok) {
          this.logger.error(
            `Non-OK response when trying to ping active Runner session. Will try again in ${consts.SESSION_RESTART_PERIOD / 1000}s`,
            resp.headers,
            sessionResp,
          )
          await wait(consts.SESSION_RESTART_PERIOD)
          continue
        }

        // We get here if we succeeded at acquiring a session.
        this.session = new RunnerSession(sessionResp.sessionID)
        this.logger.log(`Acquired session "${this.session.id}"`)

        this.cachedSessionID = this.session.id
        this.status = SessionStatus.Connected
        // TODO: Make sure that we can actually connect to the Websocket server
        // Orchestrator server should communicate that the Firecracker machine's Runner process is ready.
        this.conn.connect(this.session.id)

        this.logger.log(`Started pinging session "${this.session.id}"`)
        while (true) {
          if (!this.session) break
          try {
            await this.session.ping()
            await wait(consts.SESSION_PING_PERIOD)
          } catch (err: any) {
            this.logger.error(`Failed to ping session "${this.session.id}"`, err)
            break
          }
        }
        this.logger.log(`Stopped pinging session "${this.session?.id}"`)

        this.session = undefined
        this.status = SessionStatus.Disconnected
        this.conn.close()
      } catch (err) {
        this.logger.error(`Failed to acquire Runner session. Will try again in ${consts.SESSION_RESTART_PERIOD / 1000}s`, err)
        await wait(consts.SESSION_RESTART_PERIOD)
      }
    }
  }
}

export default SessionManager
