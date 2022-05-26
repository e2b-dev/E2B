import {
  RpcWebSocketClient,
  IRpcNotification,
} from 'rpc-websocket-client'

import api, {
  components,
  getSessionURL,
} from './api'
import wait from './utils/wait'
import {
  SESSION_DOMAIN,
  SESSION_REFRESH_PERIOD,
  WS_PORT,
} from './constants'
import Logger from './utils/logger'

type CodeSnippetState = 'running' | 'stopped'

type StateHandler = (state: CodeSnippetState) => void
type StderrHandler = (stderr: string) => void
type StdoutHandler = (stdout: string) => void

type SubscriptionEvent = 'state' | 'stderr' | 'stdout'
type SubscriptionHandler = StateHandler | StderrHandler | StdoutHandler

type SubscriptionHandlerType = {
  'state': StateHandler
  'stderr': StderrHandler
  'stdout': StdoutHandler
}

interface Subscriber {
  id: string
  event: SubscriptionEvent
  handler: SubscriptionHandler
}

const getSession = api.path('/sessions').method('post').create()
const refreshSession = api.path('/sessions/{sessionID}/refresh').method('put').create()

class Session {
  private session?: components['schemas']['Session']
  private readonly rpc = new RpcWebSocketClient()
  private subscribers: Subscriber[] = []
  private _isActive = false
  private readonly logger: Logger

  get isActive() {
    return this._isActive
  }
  private set isActive(value: boolean) {
    this._isActive = value
  }

  constructor(
    private readonly codeSnippetID: string,
    private readonly onDisconnect?: () => void,
  ) {
    this.logger = new Logger('Session', true)
    this.logger.log(`Session for code snippet "${codeSnippetID}" initialized`)
  }

  unsubscribe(event: SubscriptionEvent, handler: SubscriptionHandler) {
    this.subscribers = this.subscribers.filter(s => s.handler !== handler || s.event !== event)
    this.logger.log(`Unsubscribed from event "${event}"`)
  }

  async subscribe<E extends SubscriptionEvent>(event: E, handler: SubscriptionHandlerType[E]) {
    const id = await this.rpc.call('codeSnippet_subscribe', [event])

    if (typeof id !== 'string') {
      throw new Error(`Cannot subscribe to event ${event}`)
    }

    this.subscribers.push({
      id,
      event,
      handler,
    })
    this.logger.log(`Subscribed to event "${event}" with id "${id}"`)
  }
  async run(code: string) {
    await this.rpc.call('codeSnippet_run', [code])
    this.logger.log('Started running code', code)
  }

  async stop() {
    await this.rpc.call('codeSnippet_stop')
    this.logger.log('Stopped running code')
  }

  disconnect() {
    if (this.isActive) {
      this.isActive = false
      this.rpc.ws.close()
      this.onDisconnect?.()
      this.logger.log('Disconected from the session')
    }
  }

  async connect() {
    if (this.isActive || !!this.session) {
      throw new Error('Session.connect was already called')
    } else {
      this.isActive = true
    }


    const res = await getSession({ codeSnippetID: this.codeSnippetID })
    this.session = res.data
    this.logger.log('Aquired session:', this.session)

    this.refresh(this.session.sessionID)

    // const sessionURL = `wss://${getSessionURL(this.session, WS_PORT)}`
    const sessionURL = 'ws://localhost:8010/ws'
    // const sessionURL = 'wss://8010-devbookhq-orchestration-axk7sf5j4y4.ws-eu46.gitpod.io:8010/ws'

    this.rpc.onNotification.push(this.handleNotification.bind(this))

    this.rpc.onClose(this.disconnect.bind(this))
    this.rpc.onError(this.disconnect.bind(this))

    this.logger.log('Connection to session:', this.session)
    await this.rpc.connect(sessionURL)
    this.logger.log('Connected to session:', this.session)
  }

  private handleNotification(data: IRpcNotification) {
    // this.logger.log('Handling notification:', data)
    this.subscribers
      .filter(s => s.id === data.params?.subscription)
      .forEach(s => s.handler(data.params?.result))
  }

  private async refresh(sessionID: string) {
    try {
      this.logger.log(`Started refreshing session "${sessionID}"`)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.isActive) {
          throw new Error('Cannot refresh session - it was closed')
        }

        await refreshSession({ sessionID })
        this.logger.log(`Refreshed session "${sessionID}"`)
        await wait(SESSION_REFRESH_PERIOD)
      }
    } catch (e) {
      this.logger.log(`Refreshing session "${sessionID}" failed:`, e)
      throw e
    } finally {
      this.disconnect()
    }
  }
}

export default Session
