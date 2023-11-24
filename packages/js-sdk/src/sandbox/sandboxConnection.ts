import { IRpcNotification, RpcWebSocketClient } from 'rpc-websocket-client'

import api, { components, withAPIKey } from '../api'
import { ENVD_PORT, SANDBOX_DOMAIN, SANDBOX_REFRESH_PERIOD, WS_RECONNECT_INTERVAL, WS_ROUTE } from '../constants'
import { AuthenticationError } from '../error'
import { assertFulfilled, formatSettledErrors, withTimeout } from '../utils/promise'
import wait from '../utils/wait'
import { codeSnippetService } from './codeSnippet'
import { filesystemService } from './filesystem'
import { processService } from './process'
import { terminalService } from './terminal'
import { EnvVars } from './envVars'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubscriptionHandler = (result: any) => void;

type Service =
  | typeof processService
  | typeof codeSnippetService
  | typeof filesystemService
  | typeof terminalService;

interface Subscriber {
  service: Service;
  subID: string;
  handler: SubscriptionHandler;
}

export interface Logger {
  debug?: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
}

export interface SandboxConnectionOpts {
  /**
   * Sandbox Template ID or name.
   * 
   * If not specified, the 'base' template will be used.
   */
  template?: string;
  /**
   * @deprecated Use `template` instead.
   * 
   * Sandbox Template ID or name.
   */
  id?: string;
  apiKey?: string;
  cwd?: string;
  envVars?: EnvVars;
  logger?: Logger;
  __sandbox?: components['schemas']['Instance'];
  __debug_hostname?: string;
  __debug_port?: number;
  __debug_devEnv?: 'remote' | 'local';
}

export interface CallOpts {
  /** Timeout for the call in milliseconds */
  timeout?: number;
}

const createSandbox = withAPIKey(
  api.path('/instances').method('post').create(),
)
const refreshSandbox = withAPIKey(
  api.path('/instances/{instanceID}/refreshes').method('post').create(),
)

export class SandboxConnection {
  cwd: string | undefined
  envVars: EnvVars

  protected readonly logger: Logger
  protected sandbox?: components['schemas']['Instance']
  protected isOpen = false

  private readonly apiKey: string
  private readonly rpc = new RpcWebSocketClient()
  private subscribers: Subscriber[] = []


  // let's keep opts readonly, but public - for convenience, mainly when debugging
  protected constructor(readonly opts: SandboxConnectionOpts) {
    this.sandbox = opts.__sandbox
    const apiKey = opts.apiKey || process?.env?.E2B_API_KEY
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit https://e2b.dev/docs to get your API key',
      )
    }
    this.apiKey = apiKey

    this.cwd = opts.cwd
    if (this.cwd && this.cwd.startsWith('~')) {
      this.cwd = this.cwd.replace('~', '/home/user')
    }

    this.envVars = opts.envVars || {}
    this.logger = opts.logger ?? {
      // by default, we log to the console
      // we don't log debug messages by default
      info: console.info,
      warn: console.warn,
      error: console.error,
    }
    this.logger.debug?.(`Sandbox "${this.templateID}" initialized`)
  }

  get id() {
    return `${this.sandbox?.instanceID}-${this.sandbox?.clientID}`
  }

  private get templateID(): string {
    return this.opts.template || this.opts.id || 'base'
  }

  /**
   * Keep the sandbox alive for the specified duration.
   *
   * `keepAlive` method requires `this` context - you may need to bind it.
   * @param duration Duration in milliseconds
   * @returns Promise that resolves when the sandbox is kept alive
   */
  public async keepAlive(duration: number) {
    duration = Math.round(duration / 1000)

    if (duration < 0 || duration > 3600) {
      throw new Error('Duration must be between 0 and 3600 seconds')
    }

    if (!this.sandbox) {
      throw new Error('Cannot keep alive - sandbox is not initialized')
    }
    await refreshSandbox(this.apiKey, {
      instanceID: this.sandbox?.instanceID, duration,
    })
  }

  /**
   * Get the hostname for the sandbox or for the specified sandbox's port.
   *
   * `getHostname` method requires `this` context - you may need to bind it.
   *
   * @param port Specify if you want to connect to a specific port of the sandbox
   * @returns Hostname of the sandbox or sandbox's port
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

    if (!this.sandbox) {
      return undefined
    }

    const hostname = `${this.sandbox.instanceID}-${this.sandbox.clientID}.${SANDBOX_DOMAIN}`
    if (port) {
      return `${port}-${hostname}`
    } else {
      return hostname
    }
  }

  /**
   * Close the connection to the sandbox
   *
   * `close` method requires `this` context - you may need to bind it.
   */
  async close() {
    if (this.isOpen) {
      this.logger.debug?.(`Closing sandbox "${this.sandbox?.instanceID}"`)
      this.isOpen = false

      this.logger.debug?.('Unsubscribing...')
      const results = await Promise.allSettled(
        this.subscribers.map((s) => this._unsubscribe(s.subID)),
      )
      results.forEach((r) => {
        if (r.status === 'rejected') {
          this.logger.warn?.(`Failed to unsubscribe: "${r.reason}"`)
        }
      })

      // This is `ws` way of closing connection
      this.rpc.ws?.terminate?.()
      // This is the browser WebSocket way of closing connection
      this.rpc.ws?.close?.()
      this.logger.debug?.('Disconnected from the sandbox')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _call(
    service: Service,
    method: string,
    params?: any[],
    opts?: CallOpts,
  ) {
    this.logger.debug?.(`Calling "${service}_${method}" with params:`, params)

    // Without the async function, the `this` context is lost.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = async (method: string, params?: any[]) =>
      await this.rpc.call(method, params)

    return await withTimeout(call, opts?.timeout)(
      `${service}_${method}`,
      params,
    )
  }

  async _handleSubscriptions<
    T extends (ReturnType<SandboxConnection['_subscribe']> | undefined)[],
  >(
    ...subs: T
  ): Promise<{
    [P in keyof T]: Awaited<T[P]>;
  }> {
    const results = await Promise.allSettled(subs)

    if (results.every((r) => r.status === 'fulfilled')) {
      return results.map((r) =>
        r.status === 'fulfilled' ? r.value : undefined,
      ) as {
          [P in keyof T]: Awaited<T[P]>;
        }
    }

    await Promise.all(
      results
        .filter(assertFulfilled)
        .map((r) => (r.value ? this._unsubscribe(r.value) : undefined)),
    )

    throw new Error(formatSettledErrors(results))
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  async _unsubscribe(subID: string) {
    const subscription = this.subscribers.find((s) => s.subID === subID)
    if (!subscription) return

    await this._call(subscription.service, 'unsubscribe', [subscription.subID])

    this.subscribers = this.subscribers.filter((s) => s !== subscription)
    this.logger.debug?.(
      `Unsubscribed '${subID}' from '${subscription.service}'`,
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/member-ordering
  async _subscribe(
    service: Service,
    handler: SubscriptionHandler,
    method: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...params: any[]
  ) {
    const subID = await this._call(service, 'subscribe', [method, ...params])

    if (typeof subID !== 'string') {
      throw new Error(
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
      `Subscribed to "${service}_${method}"${params.length > 0 ? ' with params [' + params.join(', ') + '] and' : ''
      } with id "${subID}"`,
    )

    return subID
  }

  /**
   * Open a connection to a new sandbox
   *
   * `open` method requires `this` context - you may need to bind it.
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for sandbox to open in milliseconds (default is 60 seconds)
   */
  protected async _open(opts: CallOpts) {
    const open = async () => {
      if (this.isOpen) {
        throw new Error('Sandbox connect was already called')
      } else {
        this.isOpen = true
      }
      this.logger.debug?.('Opening sandbox...')

      if (!this.sandbox) {
        try {
          const res = await createSandbox(this.apiKey, {
            envID: this.templateID,
          })

          this.sandbox = res.data
          this.logger.debug?.(`Acquired sandbox "${this.sandbox.instanceID}"`)
        } catch (e) {
          if (e instanceof createSandbox.Error) {
            const error = e.getActualType()
            if (error.status === 400) {
              throw new Error(
                `Error creating sandbox - (${error.status}) bad request: ${error.data.message}`,
              )
            }
            if (error.status === 401) {
              throw new Error(
                `Error creating sandbox - (${error.status}) unauthenticated: ${error.data.message}`,
              )
            }
            if (error.status === 500) {
              throw new Error(
                `Error creating sandbox - (${error.status}) server error: ${error.data.message}`,
              )
            }
          }
          throw e
        }
      }
      this.refresh(this.sandbox.instanceID)
      await this.connectRpc()
      return this
    }
    return await withTimeout(open, opts?.timeout)()
  }

  private async connectRpc() {
    const hostname = this.getHostname(this.opts.__debug_port || ENVD_PORT)

    if (!hostname) {
      throw new Error('Cannot get sandbox\'s hostname')
    }

    const protocol = this.opts.__debug_devEnv === 'local' ? 'ws' : 'wss'
    const sandboxURL = `${protocol}://${hostname}${WS_ROUTE}`

    this.rpc.onError((err) => {
      // not warn, because this is somewhat expected behaviour during initialization
      this.logger.debug?.(
        `Error in WebSocket of sandbox "${this.sandbox?.instanceID}": ${err.message ?? err.code ?? err.toString()
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
      this.logger.debug?.(
        `Connected to sandbox "${this.sandbox?.instanceID}"`,
      )
      resolveOpening?.()
    })

    this.rpc.onClose(async () => {
      this.logger.debug?.(
        `Closing WebSocket connection to sandbox "${this.sandbox?.instanceID}"`,
      )
      if (this.isOpen) {
        await wait(WS_RECONNECT_INTERVAL)
        this.logger.debug?.(
          `Reconnecting to sandbox "${this.sandbox?.instanceID}"`,
        )
        try {
          // When the WS connection closes the subscribers in devbookd are removed.
          // We want to delete the subscriber handlers here so there are no orphans.
          this.subscribers = []
          await this.rpc.connect(sandboxURL)
          this.logger.debug?.(
            `Reconnected to sandbox "${this.sandbox?.instanceID}"`,
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // not warn, because this is somewhat expected behaviour during initialization
          this.logger.debug?.(
            `Failed reconnecting to sandbox "${this.sandbox?.instanceID}": ${err.message ?? err.code ?? err.toString()
            }`,
          )
        }
      } else {
        rejectOpening?.()
      }
    })

    this.rpc.onNotification.push(this.handleNotification.bind(this))

    try {
      this.logger.debug?.(
        `Connection to sandbox "${this.sandbox?.instanceID}"`,
      )
      await this.rpc.connect(sandboxURL)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // not warn, because this is somewhat expected behaviour during initialization
      this.logger.debug?.(
        `Error connecting to sandbox "${this.sandbox?.instanceID}": ${err.message ?? err.code ?? err.toString()
        }`,
      )
    }

    await openingPromise
  }
  private handleNotification(data: IRpcNotification) {
    this.logger.debug?.('Handling notification:', data)
    this.subscribers
      .filter((s) => s.subID === data.params?.subscription)
      .forEach((s) => s.handler(data.params?.result))
  }

  private async refresh(instanceID: string) {
    this.logger.debug?.(`Started refreshing sandbox "${instanceID}"`)

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.isOpen) {
          this.logger.debug?.(
            `Cannot refresh sandbox ${this.sandbox?.instanceID} - it was closed`,
          )
          return
        }

        await wait(SANDBOX_REFRESH_PERIOD)

        try {
          this.logger.debug?.(`Refreshed sandbox "${instanceID}"`)

          await refreshSandbox(this.apiKey, {
            instanceID, duration: 0,
          })
        } catch (e) {
          if (e instanceof refreshSandbox.Error) {
            const error = e.getActualType()
            if (error.status === 404) {
              this.logger.warn?.(
                `Error refreshing sandbox - (${error.status}): ${error.data.message}`,
              )
              return
            }
            this.logger.warn?.(
              `Refreshing sandbox "${instanceID}" failed - (${error.status})`,
            )
          }
        }
      }
    } finally {
      this.logger.debug?.(`Stopped refreshing sandbox "${instanceID}"`)
      await this.close()
    }
  }
}
