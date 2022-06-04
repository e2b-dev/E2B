import {
  RpcWebSocketClient,
  IRpcNotification,
} from 'rpc-websocket-client'

import api, {
  components,
} from '../api'
import wait from '../utils/wait'
import {
  SESSION_DOMAIN,
  SESSION_REFRESH_PERIOD,
  WS_PORT,
  WS_RECONNECT_INTERVAL,
  WS_ROUTE,
} from '../constants'
import Logger from '../utils/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubscriptionHandler = (result: any) => void

interface Subscriber {
  id: string
  handler: SubscriptionHandler
}

export type CloseHandler = () => void

export interface SessionConnectionOpts {
  id: string
  onClose?: CloseHandler
  debug?: boolean
  editEnabled?: boolean
}

const createSession = api.path('/sessions').method('post').create()
const refreshSession = api.path('/sessions/{sessionID}/refresh').method('put').create()

abstract class SessionConnection {
  protected readonly logger: Logger
  protected session?: components['schemas']['Session']
  protected isOpen = false

  private readonly rpc = new RpcWebSocketClient()
  private subscribers: Subscriber[] = []

  constructor(private readonly opts: SessionConnectionOpts) {
    this.logger = new Logger('Session', opts.debug)
    this.logger.log(`Session for code snippet "${opts.id}" initialized`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async call(method: string, params?: any[]) {
    return this.rpc.call(method, params)
  }

  protected async unsubscribe(method: string, handler: SubscriptionHandler) {
    const subscription = this.subscribers.find(s => s.handler === handler)
    if (!subscription) return

    await this.call(`${method}_unsubscribe`, [subscription?.id])

    this.subscribers = this.subscribers.filter(s => s.handler !== handler)
    this.logger.log(`Unsubscribed from method "${method}"`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async subscribe(method: string, handler: SubscriptionHandler, params?: any) {
    const id = await this.call(`${method}_subscribe`, [params])

    if (typeof id !== 'string') {
      throw new Error(`Cannot subscribe to method ${method}. Ecpected response to be a subscription ID, instead got ${JSON.stringify(id)}`)
    }

    this.subscribers.push({
      id,
      handler,
    })
    this.logger.log(`Subscribed to method "${method}" with id "${id}"`)
  }

  getHostname(port?: number) {
    if (!this.isOpen || !this.session) {
      throw new Error('Session is not active')
    }

    const hostname = `${this.session.sessionID}-${this.session.clientID}.${SESSION_DOMAIN}`
    if (port) {
      return `${port}-${hostname}`
    } else {
      return hostname
    }
  }

  close() {
    if (this.isOpen) {
      this.isOpen = false
      this.rpc.ws?.close()
      this.opts?.onClose?.()
      this.logger.log('Disconected from the session')
    }
  }

  async open() {
    if (this.isOpen || !!this.session) {
      throw new Error('Session connect was already called')
    } else {
      this.isOpen = true
    }

    try {
      const res = await createSession({
        codeSnippetID: this.opts.id,
        editEnabled: this.opts.editEnabled,
      })
      this.session = res.data
      this.logger.log('Aquired session:', this.session)

      this.refresh(this.session.sessionID)
    } catch (e) {
      if (e instanceof createSession.Error) {
        const error = e.getActualType()
        if (error.status === 400) {
          throw new Error(`Error creating session - (${error.status}) bad request: ${error.data.message}`)
        }
        if (error.status === 500) {
          throw new Error(`Error creating session - (${error.status}) server error: ${error.data.message}`)
        }
        throw e
      }
    }

    if (!this.session) {
      throw new Error('Session is not defined')
    }

    const sessionURL = `wss://${this.getHostname(WS_PORT)}${WS_ROUTE}`

    this.logger.log('Connection to session:', this.session)
    await this.rpc.connect(sessionURL)
    this.logger.log('Connected to session:', this.session)

    this.rpc.onClose(async (e) => {
      this.logger.log('Closing WS connection to session:', this.session, e)
      if (this.isOpen) {
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

    this.rpc.onNotification.push(this.handleNotification.bind(this))
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
        if (!this.isOpen) {
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
              this.logger.error(`Error refreshing session - (${error.status}): ${error.data.message}`)
              return
            }
            this.logger.error(`Refreshing session "${sessionID}" failed - (${error.status})`)
          }
        }
      }
    } finally {
      this.logger.log(`Stopped refreshing session "${sessionID}"`)
      this.close()
    }
  }
}

export default SessionConnection
