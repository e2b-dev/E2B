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
  subscriptionID: string
  handler: SubscriptionHandler
  method: string
}

export type CloseHandler = () => void

export interface SessionConnectionOpts {
  id: string
  apiKey?: string
  onClose?: CloseHandler
  debug?: boolean
  editEnabled?: boolean
}

const createSession = api.path('/sessions').method('post').create({ api_key: true })
const refreshSession = api.path('/sessions/{sessionID}/refresh').method('post').create({ api_key: true })

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

  protected async unsubscribe(subscriptionID: string) {
    const subscription = this.subscribers.find(s => s.subscriptionID === subscriptionID)
    if (!subscription) return

    await this.call(`${subscription.method}_unsubscribe`, [subscription?.subscriptionID])

    this.subscribers = this.subscribers.filter(s => s !== subscription)
    this.logger.log(`Unsubscribed from "${subscription.method}"`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async subscribe(method: string, handler: SubscriptionHandler, ...params: any) {
    const subscriptionID = await this.call(`${method}_subscribe`, params)

    if (typeof subscriptionID !== 'string') {
      throw new Error(`Cannot subscribe to ${method} with params ${params}. Expected response to be a subscription ID, instead got ${JSON.stringify(subscriptionID)}`)
    }

    this.subscribers.push({
      subscriptionID,
      handler,
      method,
    })
    this.logger.log(`Subscribed to "${method}_${params}" with id "${subscriptionID}"`)

    return subscriptionID
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

  async close() {
    if (this.isOpen) {
      this.logger.log('Closing', this.session)
      this.isOpen = false

      this.logger.log('Unsubscribing...')
      const results = await Promise.allSettled(
        this.subscribers.map(s => this.unsubscribe(s.subscriptionID)),
      )
      results.forEach(r => {
        if (r.status === 'rejected') {
          this.logger.log(`Failed to unsubscribe: "${r.reason}"`)
        }
      })

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
        api_key: this.opts.apiKey,
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
        if (error.status === 401) {
          throw new Error(`Error creating session - (${error.status}) unauthenticated (you need to be authenticated to start an session with persistent edits): ${error.data.message}`)
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

    this.rpc.onError((e) => {
      this.logger.log('Error in WS session:', this.session, e)
    })

    let isFinished = false
    let resolveOpening: (() => void) | undefined
    let rejectOpening: (() => void) | undefined

    const openingPromise = new Promise<void>((resolve, reject) => {
      resolveOpening = () => {
        if (isFinished) return
        isFinished = true
        resolve()
      }
      rejectOpening = () => {
        if (isFinished) return
        isFinished = true
        reject()
      }
    })

    this.rpc.onOpen(() => {
      this.logger.log('Connected to session:', this.session)
      resolveOpening?.()
    })

    this.rpc.onClose(async (e) => {
      this.logger.log('Closing WS connection to session:', this.session, e)
      if (this.isOpen) {
        await wait(WS_RECONNECT_INTERVAL)
        this.logger.log('Reconnecting to session:', this.session)
        try {
          await this.rpc.connect(sessionURL)
          this.logger.log('Reconnected to session:', this.session)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          this.logger.log('Failed reconnecting to session:', this.session, e)
        }
      } else {
        rejectOpening?.()
      }
    })

    this.rpc.onNotification.push(this.handleNotification.bind(this))

    try {
      this.logger.log('Connection to session:', this.session)
      await this.rpc.connect(sessionURL)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      this.logger.log('Error connecting to session', this.session, e)
    }

    await openingPromise
  }

  private handleNotification(data: IRpcNotification) {
    this.subscribers
      .filter(s => s.subscriptionID === data.params?.subscription)
      .forEach(s => s.handler(data.params?.result))
  }

  private async refresh(sessionID: string) {
    this.logger.log(`Started refreshing session "${sessionID}"`)

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.isOpen) {
          this.logger.log('Cannot refresh session - it was closed', this.session)
          return
        }

        await wait(SESSION_REFRESH_PERIOD)

        try {
          this.logger.log(`Refreshed session "${sessionID}"`)
          await refreshSession({
            sessionID,
            api_key: this.opts.apiKey,
          })
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
