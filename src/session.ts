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
  SESSION_REFRESH_PERIOD,
  WS_PORT,
  WS_RECONNECT_INTERVAL,
  WS_ROUTE,
} from './constants'
import Logger from './utils/logger'

export type CodeSnippetState = 'running' | 'stopped'

export type StateHandler = (state: CodeSnippetState) => void
export type StderrHandler = (stderr: string) => void
export type StdoutHandler = (stdout: string) => void

export type SubscriptionEvent = 'state' | 'stderr' | 'stdout'
export type SubscriptionHandler = StateHandler | StderrHandler | StdoutHandler

export type SubscriptionHandlerType = {
  'state': StateHandler
  'stderr': StderrHandler
  'stdout': StdoutHandler
}

export interface Subscriber {
  id: string
  event: SubscriptionEvent
  handler: SubscriptionHandler
}

export type CloseHandler = () => void

export interface SessionHandlers {
  onStateChange?: StateHandler
  onStderr?: StderrHandler
  onStdout?: StdoutHandler
  onClose?: CloseHandler
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
    private readonly handlers?: SessionHandlers,
    debug?: boolean
  ) {
    this.logger = new Logger('Session', debug)
    this.logger.log(`Session for code snippet "${codeSnippetID}" initialized`)
  }

  private async unsubscribe(event: SubscriptionEvent, handler: SubscriptionHandler) {
    const subscription = this.subscribers.find(s => s.handler === handler && s.event === event)
    if (!subscription) return

    await this.rpc.call('codeSnippet_unsubscribe', [subscription?.id])

    this.subscribers = this.subscribers.filter(s => s.handler !== handler || s.event !== event)
    this.logger.log(`Unsubscribed from event "${event}"`)
  }

  private async subscribe<E extends SubscriptionEvent>(event: E, handler: SubscriptionHandlerType[E]) {
    const id = await this.rpc.call('codeSnippet_subscribe', [event])

    if (typeof id !== 'string') {
      throw new Error(`Cannot subscribe to event ${event}. Ecpected response to be a subscription ID, instead got ${JSON.stringify(id)}`)
    }

    this.subscribers.push({
      id,
      event,
      handler,
    })
    this.logger.log(`Subscribed to event "${event}" with id "${id}"`)
  }

  async run(code: string) {
    if (!this.isActive || !this.session) {
      throw new Error('Session is not active')
    }

    await this.rpc.call('codeSnippet_run', [code])
    this.logger.log('Started running code', code)
  }

  async stop() {
    if (!this.isActive || !this.session) {
      throw new Error('Session is not active')
    }

    await this.rpc.call('codeSnippet_stop')
    this.logger.log('Stopped running code')
  }

  disconnect() {
    if (this.isActive) {
      this.isActive = false
      this.rpc.ws?.close()
      this.handlers?.onClose?.()
      this.logger.log('Disconected from the session')
    }
  }

  async connect() {
    if (this.isActive || !!this.session) {
      throw new Error('Session connect was already called')
    } else {
      this.isActive = true
    }

    try {
      const res = await getSession({ codeSnippetID: this.codeSnippetID })
      this.session = res.data
      this.logger.log('Aquired session:', this.session)

    } catch (e) {
      if (e instanceof getSession.Error) {
        const error = e.getActualType()
        if (error.status === 400) {
          throw new Error(`Error creating session - bad request: ${error}`)
        }
        if (error.status === 500) {
          throw new Error(`Error creating session - server error: ${error}`)
        }
        throw e
      }
    }

    if (!this.session) return

    this.refresh(this.session.sessionID)

    const sessionURL = `wss://${getSessionURL(this.session, WS_PORT)}${WS_ROUTE}`

    this.logger.log('Connection to session:', this.session)
    await this.rpc.connect(sessionURL)
    this.logger.log('Connected to session:', this.session)

    this.rpc.onClose(async (e) => {
      this.logger.log('Closing WS connection to session:', this.session, e)
      if (this.isActive) {
        await wait(WS_RECONNECT_INTERVAL)
        this.logger.log('Reconnecting to session:', this.session)
        try {
          await this.rpc.connect(sessionURL)
          this.logger.log('Reconnected to session:', this.session)
        } catch (e) {
          this.logger.error('Failed reconnecting to session:', this.session)
        }
      }
    })

    this.rpc.onError((e) => {
      this.logger.error('Error in WS session:', this.session, e)
    })

    await Promise.all([
      this.handlers?.onStateChange ? this.subscribe('state', this.handlers.onStateChange) : Promise.resolve(),
      this.handlers?.onStderr ? this.subscribe('stderr', this.handlers.onStderr) : Promise.resolve(),
      this.handlers?.onStdout ? this.subscribe('stdout', this.handlers.onStdout) : Promise.resolve(),
    ])

    this.rpc.onNotification.push(this.handleNotification.bind(this))

    this.logger.log('Connected handlers for session:', this.session)
  }

  private handleNotification(data: IRpcNotification) {
    this.subscribers
      .filter(s => s.id === data.params?.subscription)
      .forEach(s => s.handler(data.params?.result))
  }

  private async refresh(sessionID: string) {
    this.logger.log(`Started refreshing session "${sessionID}"`)

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.isActive) {
          this.logger.log('Cannot refresh session - it was closed')
          return
        }

        await wait(SESSION_REFRESH_PERIOD)

        try {
          this.logger.log(`Refreshed session "${sessionID}"`)
          await refreshSession({ sessionID })
        } catch (e) {
          if (e instanceof refreshSession.Error) {
            const error = e.getActualType()
            if (error.status === 404) {
              this.logger.error(`Error refreshing session ${error}`)
              return
            }
            this.logger.error(`Refreshing session "${sessionID}" failed: ${error.status}`)
          }
        }
      }
    } finally {
      this.logger.log(`Stopped refreshing session "${sessionID}"`)
      this.disconnect()
    }
  }
}

export default Session
