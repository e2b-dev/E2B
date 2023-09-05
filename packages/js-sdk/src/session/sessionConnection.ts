import { IRpcNotification, RpcWebSocketClient } from 'rpc-websocket-client'

import api, { components } from '../api'
import {
  SESSION_DOMAIN,
  SESSION_REFRESH_PERIOD,
  WS_PORT,
  WS_RECONNECT_INTERVAL,
  WS_ROUTE,
} from '../constants'
import { assertFulfilled, formatSettledErrors } from '../utils/promise'
import wait from '../utils/wait'
import { codeSnippetService } from './codeSnippet'
import { AuthenticationError } from './error'
import { filesystemService } from './filesystem'
import { processService } from './process'
import { terminalService } from './terminal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubscriptionHandler = (result: any) => void

type Service =
  | typeof processService
  | typeof codeSnippetService
  | typeof filesystemService
  | typeof terminalService

interface Subscriber {
  service: Service
  subID: string
  handler: SubscriptionHandler
}

interface Logger {
  debug?: (message: string, ...args: unknown[]) => void
  info?: (message: string, ...args: unknown[]) => void
  warn?: (message: string, ...args: unknown[]) => void
  error?: (message: string, ...args: unknown[]) => void
}

export interface SessionConnectionOpts {
  id: string
  apiKey: string
  logger?: Logger
  __debug_hostname?: string
  __debug_port?: number
  __debug_devEnv?: 'remote' | 'local'
}

const createSession = api.path('/sessions').method('post').create({ api_key: true })
const refreshSession = api
  .path('/sessions/{sessionID}/refresh')
  .method('post')
  .create({ api_key: true })

export class SessionConnection {
  protected readonly logger: Logger
  protected session?: components['schemas']['Session']
  protected isOpen = false

  private readonly rpc = new RpcWebSocketClient()
  private subscribers: Subscriber[] = []

  constructor(private readonly opts: SessionConnectionOpts) {
    if (!opts.apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit https://e2b.dev/docs to get your API key',
      )
    }
    this.logger = opts.logger ?? {
      // by default, we log to the console, only warnings and errors
      warn: console.warn,
      error: console.error,
    }
    this.logger.info?.(`Session for code snippet "${opts.id}" initialized`)
  }

  /**
   * Get the hostname for the session or for the specified session's port.
   *
   * `getHostname` method requires `this` context - you may need to bind it.
   *
   * @param port specify if you want to connect to a specific port of the session
   * @returns hostname of the session or session's port
   */
  getHostname(port?: number) {
    if (this.opts.__debug_hostname) {
      // Debugging remotely (with GitPod) and on local needs different formats of the hostname.
      if (port && this.opts.__debug_devEnv === 'remote') {
        return `${port}-${this.opts.__debug_hostname}`
      } else if (port) {
        return `${this.opts.__debug_hostname}:${port}`
      } else {
        return this.opts.__debug_hostname
      }
    }

    if (!this.session) {
      return undefined
    }

    const hostname = `${this.session.sessionID}-${this.session.clientID}.${SESSION_DOMAIN}`
    if (port) {
      return `${port}-${hostname}`
    } else {
      return hostname
    }
  }

  /**
   * Close the connection to the session
   *
   * `close` method requires `this` context - you may need to bind it.
   */
  async close() {
    if (this.isOpen) {
      this.logger.debug?.(`Closing session "${this.session?.sessionID}"`)
      this.isOpen = false

      this.logger.debug?.('Unsubscribing...')
      const results = await Promise.allSettled(
        this.subscribers.map(s => this.unsubscribe(s.subID)),
      )
      results.forEach(r => {
        if (r.status === 'rejected') {
          this.logger.warn?.(`Failed to unsubscribe: "${r.reason}"`)
        }
      })

      // This is `ws` way of closing connection
      this.rpc.ws?.terminate?.()
      // This is the browser WebSocket way of closing connection
      this.rpc.ws?.close?.()
      this.logger.info?.('Disconnected from the session')
    }
  }

  /**
   * Open a connection to a new session
   *
   * `open` method requires `this` context - you may need to bind it.
   */
  async open() {
    if (this.isOpen || !!this.session) {
      throw new Error('Session connect was already called')
    } else {
      this.isOpen = true
    }
    this.logger.debug?.('Opening session...')

    if (!this.opts.__debug_hostname) {
      try {
        const res = await createSession({
          api_key: this.opts.apiKey,
          codeSnippetID: this.opts.id,
          editEnabled: false,
        })
        this.session = res.data
        this.logger.debug?.(`Acquired session "${this.session.sessionID}"`)

        this.refresh(this.session.sessionID)
      } catch (e) {
        if (e instanceof createSession.Error) {
          const error = e.getActualType()
          if (error.status === 400) {
            throw new Error(
              `Error creating session - (${error.status}) bad request: ${error.data.message}`,
            )
          }
          if (error.status === 401) {
            throw new Error(
              `Error creating session - (${error.status}) unauthenticated: ${error.data.message}`,
            )
          }
          if (error.status === 500) {
            throw new Error(
              `Error creating session - (${error.status}) server error: ${error.data.message}`,
            )
          }
        }
        throw e
      }
    }

    const hostname = this.getHostname(this.opts.__debug_port || WS_PORT)

    if (!hostname) {
      throw new Error("Cannot get session's hostname")
    }

    const protocol = this.opts.__debug_devEnv === 'local' ? 'ws' : 'wss'
    const sessionURL = `${protocol}://${hostname}${WS_ROUTE}`

    this.rpc.onError(err => {
      this.logger.warn?.(
        `Error in WS session "${this.session?.sessionID}": ${
          err.message ?? err.code ?? err.toString()
        }. Trying to reconnect...`,
      )
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
      this.logger.debug?.(`Connected to session "${this.session?.sessionID}"`)
      resolveOpening?.()
    })

    this.rpc.onClose(async e => {
      this.logger.debug?.(`Closing WS connection to session "${this.session?.sessionID}"`)
      if (this.isOpen) {
        await wait(WS_RECONNECT_INTERVAL)
        this.logger.debug?.(`Reconnecting to session "${this.session?.sessionID}"`)
        try {
          // When the WS connection closes the subscribers in devbookd are removed.
          // We want to delete the subscriber handlers here so there are no orphans.
          this.subscribers = []
          await this.rpc.connect(sessionURL)
          this.logger.debug?.(`Reconnected to session "${this.session?.sessionID}"`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          this.logger.warn?.(
            `Failed reconnecting to session "${this.session?.sessionID}": ${
              err.message ?? err.code ?? err.toString()
            }`,
          )
        }
      } else {
        rejectOpening?.()
      }
    })

    this.rpc.onNotification.push(this.handleNotification.bind(this))

    try {
      this.logger.debug?.(`Connection to session "${this.session?.sessionID}"`)
      await this.rpc.connect(sessionURL)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      this.logger.warn?.(
        `Error connecting to session "${this.session?.sessionID}": ${
          err.message ?? err.code ?? err.toString()
        }`,
      )
    }

    await openingPromise
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async call(service: Service, method: string, params?: any[]) {
    this.logger.debug?.(`Calling "${service}_${method}" with params:`, params)
    return this.rpc.call(`${service}_${method}`, params)
  }

  async handleSubscriptions<
    T extends (ReturnType<SessionConnection['subscribe']> | undefined)[],
  >(
    ...subs: T
  ): Promise<{
    [P in keyof T]: Awaited<T[P]>
  }> {
    const results = await Promise.allSettled(subs)

    if (results.every(r => r.status === 'fulfilled')) {
      return results.map(r => (r.status === 'fulfilled' ? r.value : undefined)) as {
        [P in keyof T]: Awaited<T[P]>
      }
    }

    await Promise.all(
      results
        .filter(assertFulfilled)
        .map(r => (r.value ? this.unsubscribe(r.value) : undefined)),
    )

    throw new Error(formatSettledErrors(results))
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  async unsubscribe(subID: string) {
    const subscription = this.subscribers.find(s => s.subID === subID)
    if (!subscription) return

    await this.call(subscription.service, 'unsubscribe', [subscription.subID])

    this.subscribers = this.subscribers.filter(s => s !== subscription)
    this.logger.debug?.(`Unsubscribed '${subID}' from '${subscription.service}'`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/member-ordering
  async subscribe(
    service: Service,
    handler: SubscriptionHandler,
    method: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...params: any[]
  ) {
    const subID = await this.call(service, 'subscribe', [method, ...params])

    if (typeof subID !== 'string') {
      throw new Error(
        // eslint-disable-next-line prettier/prettier
        `Cannot subscribe to ${service}_${method}${params.length > 0 ? ' with params [' + params.join(', ') + ']' : ''
        }. Expected response should have been a subscription ID, instead we got ${JSON.stringify(
          subID,
        )}`,
      )
    }

    this.subscribers.push({
      handler,
      service,
      subID,
    })
    this.logger.debug?.(
      // eslint-disable-next-line prettier/prettier
      `Subscribed to "${service}_${method}"${params.length > 0 ? ' with params [' + params.join(', ') + '] and' : ''
      } with id "${subID}"`,
    )

    return subID
  }

  private handleNotification(data: IRpcNotification) {
    this.logger.debug?.('Handling notification:', data)
    this.subscribers
      .filter(s => s.subID === data.params?.subscription)
      .forEach(s => s.handler(data.params?.result))
  }

  private async refresh(sessionID: string) {
    this.logger.debug?.(`Started refreshing session "${sessionID}"`)

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.isOpen) {
          this.logger.warn?.(
            `Cannot refresh session ${this.session?.sessionID} - it was closed`,
          )
          return
        }

        await wait(SESSION_REFRESH_PERIOD)

        try {
          this.logger.debug?.(`Refreshed session "${sessionID}"`)
          await refreshSession({
            api_key: this.opts.apiKey,
            sessionID,
          })
        } catch (e) {
          if (e instanceof refreshSession.Error) {
            const error = e.getActualType()
            if (error.status === 404) {
              this.logger.warn?.(
                `Error refreshing session - (${error.status}): ${error.data.message}`,
              )
              return
            }
            this.logger.warn?.(
              `Refreshing session "${sessionID}" failed - (${error.status})`,
            )
          }
        }
      }
    } finally {
      this.logger.debug?.(`Stopped refreshing session "${sessionID}"`)
      this.close()
    }
  }
}
