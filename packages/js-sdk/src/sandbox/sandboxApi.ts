import { ApiClient, components, handleApiError } from '../api'
import {
  ConnectionConfig,
  ConnectionOpts,
  DEFAULT_SANDBOX_TIMEOUT_MS,
} from '../connectionConfig'
import { compareVersions } from 'compare-versions'
import { NotFoundError, TemplateError } from '../errors'
import { timeoutToSeconds } from '../utils'
import type { McpServer as BaseMcpServer } from './mcp'

/**
 * Extended MCP server configuration that includes base servers
 * and allows dynamic GitHub-based MCP servers with custom run and install commands.
 */
export type McpServer = BaseMcpServer | GitHubMcpServer

export type GitHubMcpServer = {
  [key: `github/${string}`]: {
    /**
     * Command to run the MCP server. Must start a stdio-compatible server.
     */
    runCmd: string
    /**
     * Command to install dependencies for the MCP server. Working directory is the root of the github repository.
     */
    installCmd?: string
    /**
     * Environment variables to set in the MCP process.
     */
    envs?: Record<string, string>
  }
}

export type SandboxNetworkOpts = {
  /**
   * Allow outbound traffic from the sandbox to the specified addresses.
   * If `allowOut` is not specified, all outbound traffic is allowed.
   *
   * Examples:
   * - To allow traffic to a specific addresses: `["1.1.1.1", "8.8.8.0/24"]`
   */
  allowOut?: string[]

  /**
   * Deny outbound traffic from the sandbox to the specified addresses.
   *
   * Examples:
   * - To deny traffic to a specific addresses: `["1.1.1.1", "8.8.8.0/24"]`
   */
  denyOut?: string[]

  /**
   * Specify if the sandbox URLs should be accessible only with authentication.
   * @default true
   */
  allowPublicTraffic?: boolean

  /** Specify host mask which will be used for all sandbox requests in the header.
   * You can use the ${PORT} variable that will be replaced with the actual port number of the service.
   *
   * @default ${PORT}-sandboxid.e2b.app
   */
  maskRequestHost?: string
}

/**
 * Options for request to the Sandbox API.
 */
export interface SandboxApiOpts
  extends Partial<
    Pick<
      ConnectionOpts,
      'apiKey' | 'headers' | 'debug' | 'domain' | 'requestTimeoutMs'
    >
  > {}

/**
 * Options for creating a new Sandbox.
 */
export interface SandboxOpts extends ConnectionOpts {
  /**
   * Custom metadata for the sandbox.
   *
   * @default {}
   */
  metadata?: Record<string, string>

  /**
   * Custom environment variables for the sandbox.
   *
   * Used when executing commands and code in the sandbox.
   * Can be overridden with the `envs` argument when executing commands or code.
   *
   * @default {}
   */
  envs?: Record<string, string>

  /**
   * Timeout for the sandbox in **milliseconds**.
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @default 300_000 // 5 minutes
   */
  timeoutMs?: number

  /**
   * Secure all traffic coming to the sandbox controller with auth token
   *
   * @default true
   */
  secure?: boolean

  /**
   * Allow sandbox to access the internet. If set to `False`, it works the same as setting network `denyOut` to `[0.0.0.0/0]`.
   *
   * @default true
   */
  allowInternetAccess?: boolean

  /**
   * MCP server to enable in the sandbox
   * @default undefined
   */
  mcp?: McpServer

  /**
   * Sandbox network configuration
   */
  network?: SandboxNetworkOpts

  /**
   * Sandbox URL. Used for local development
   */
  sandboxUrl?: string
}

export type SandboxBetaCreateOpts = SandboxOpts & {
  /**
   * Automatically pause the sandbox after the timeout expires.
   * @default false
   */
  autoPause?: boolean
}

/**
 * Options for connecting to a Sandbox.
 */
export type SandboxConnectOpts = ConnectionOpts & {
  /**
   * Timeout for the sandbox in **milliseconds**.
   * For running sandboxes, the timeout will update only if the new timeout is longer than the existing one.
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @default 300_000 // 5 minutes
   */
  timeoutMs?: number
}

/**
 * State of the sandbox.
 */
export type SandboxState = 'running' | 'paused'

export interface SandboxListOpts extends SandboxApiOpts {
  /**
   * Filter the list of sandboxes, e.g. by metadata `metadata:{"key": "value"}`, if there are multiple filters they are combined with AND.
   *
   */
  query?: {
    metadata?: Record<string, string>
    /**
     * Filter the list of sandboxes by state.
     * @default ['running', 'paused']
     */
    state?: Array<SandboxState>
  }

  /**
   * Number of sandboxes to return per page.
   *
   * @default 100
   */
  limit?: number

  /**
   * Token to the next page.
   */
  nextToken?: string
}

export interface SandboxMetricsOpts extends SandboxApiOpts {
  /**
   * Start time for the metrics, defaults to the start of the sandbox
   */
  start?: string | Date
  /**
   * End time for the metrics, defaults to the current time
   */
  end?: string | Date
}

/**
 * Information about a sandbox.
 */
export interface SandboxInfo {
  /**
   * Sandbox ID.
   */
  sandboxId: string

  /**
   * Template ID.
   */
  templateId: string

  /**
   * Template name.
   */
  name?: string

  /**
   * Saved sandbox metadata.
   */
  metadata: Record<string, string>

  /**
   * Sandbox start time.
   */
  startedAt: Date

  /**
   * Sandbox expiration date.
   */
  endAt: Date

  /**
   * Sandbox state.
   *
   * @string can be `running` or `paused`
   */
  state: SandboxState

  /**
   * Sandbox CPU count.
   */
  cpuCount: number

  /**
   * Sandbox Memory size in MiB.
   */
  memoryMB: number

  /**
   * Envd version.
   */
  envdVersion: string
}

/**
 * Sandbox resource usage metrics.
 */
export interface SandboxMetrics {
  /**
   * Timestamp of the metrics.
   */
  timestamp: Date

  /**
   * CPU usage in percentage.
   */
  cpuUsedPct: number

  /**
   * Number of CPU cores.
   */
  cpuCount: number

  /**
   * Memory usage in bytes.
   */
  memUsed: number

  /**
   * Total memory available in bytes.
   */
  memTotal: number

  /**
   * Used disk space in bytes.
   */
  diskUsed: number

  /**
   * Total disk space available in bytes.
   */
  diskTotal: number
}

export class SandboxApi {
  protected constructor() {}

  /**
   * Kill the sandbox specified by sandbox ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns `true` if the sandbox was found and killed, `false` otherwise.
   */
  static async kill(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      return false
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return true
  }

  /**
   * Get sandbox information like sandbox ID, template, metadata, started at/end at date.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns sandbox information.
   */
  static async getInfo(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<SandboxInfo> {
    const fullInfo = await this.getFullInfo(sandboxId, opts)
    delete fullInfo.envdAccessToken
    delete fullInfo.sandboxDomain

    return fullInfo
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param sandboxId sandbox ID.
   * @param opts sandbox metrics options.
   *
   * @returns  List of sandbox metrics containing CPU, memory and disk usage information.
   */
  static async getMetrics(
    sandboxId: string,
    opts?: SandboxMetricsOpts
  ): Promise<SandboxMetrics[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes/{sandboxID}/metrics', {
      params: {
        path: {
          sandboxID: sandboxId,
          start: opts?.start,
          end: opts?.end,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return (
      res.data?.map((metric: components['schemas']['SandboxMetric']) => ({
        timestamp: new Date(metric.timestamp),
        cpuUsedPct: metric.cpuUsedPct,
        cpuCount: metric.cpuCount,
        memUsed: metric.memUsed,
        memTotal: metric.memTotal,
        diskUsed: metric.diskUsed,
        diskTotal: metric.diskTotal,
      })) ?? []
    )
  }

  /**
   * Set the timeout of the specified sandbox.
   * After the timeout expires the sandbox will be automatically killed.
   *
   * This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to {@link Sandbox.setTimeout}.
   *
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @param sandboxId sandbox ID.
   * @param timeoutMs timeout in **milliseconds**.
   * @param opts connection options.
   */
  static async setTimeout(
    sandboxId: string,
    timeoutMs: number,
    opts?: SandboxApiOpts
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/timeout', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: {
        timeout: timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Sandbox ${sandboxId} not found`)
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }
  }

  static async getFullInfo(sandboxId: string, opts?: SandboxApiOpts) {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Sandbox ${sandboxId} not found`)
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Sandbox not found')
    }

    return {
      sandboxId: res.data.sandboxID,
      templateId: res.data.templateID,
      ...(res.data.alias && { name: res.data.alias }),
      metadata: res.data.metadata ?? {},
      envdVersion: res.data.envdVersion,
      envdAccessToken: res.data.envdAccessToken,
      startedAt: new Date(res.data.startedAt),
      endAt: new Date(res.data.endAt),
      state: res.data.state,
      cpuCount: res.data.cpuCount,
      memoryMB: res.data.memoryMB,
      sandboxDomain: res.data.domain || undefined,
    }
  }

  /**
   * Pause the sandbox specified by sandbox ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns `true` if the sandbox got paused, `false` if the sandbox was already paused.
   */
  static async betaPause(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/pause', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Sandbox ${sandboxId} not found`)
    }

    if (res.error?.code === 409) {
      // Sandbox is already paused
      return false
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return true
  }

  protected static async createSandbox(
    template: string,
    timeoutMs: number,
    opts?: SandboxBetaCreateOpts
  ) {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes', {
      body: {
        autoPause: opts?.autoPause ?? false,
        templateID: template,
        metadata: opts?.metadata,
        mcp: opts?.mcp as Record<string, unknown> | undefined,
        envVars: opts?.envs,
        timeout: timeoutToSeconds(timeoutMs),
        secure: opts?.secure ?? true,
        allow_internet_access: opts?.allowInternetAccess ?? true,
        network: opts?.network,
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    if (compareVersions(res.data!.envdVersion, '0.1.0') < 0) {
      await this.kill(res.data!.sandboxID, opts)
      throw new TemplateError(
        'You need to update the template to use the new SDK. ' +
          'You can do this by running `e2b template build` in the directory with the template.'
      )
    }

    return {
      sandboxId: res.data!.sandboxID,
      sandboxDomain: res.data!.domain || undefined,
      envdVersion: res.data!.envdVersion,
      envdAccessToken: res.data!.envdAccessToken,
      trafficAccessToken: res.data!.trafficAccessToken || undefined,
    }
  }

  protected static async connectSandbox(
    sandboxId: string,
    opts?: SandboxConnectOpts
  ) {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS

    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/connect', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: {
        timeout: timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Paused sandbox ${sandboxId} not found`)
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return {
      sandboxId: res.data!.sandboxID,
      sandboxDomain: res.data!.domain || undefined,
      envdVersion: res.data!.envdVersion,
      envdAccessToken: res.data!.envdAccessToken,
      trafficAccessToken: res.data!.trafficAccessToken || undefined,
    }
  }
}

/**
 * Paginator for listing sandboxes.
 *
 * @example
 * ```ts
 * const paginator = Sandbox.list()
 *
 * while (paginator.hasNext) {
 *   const sandboxes = await paginator.nextItems()
 *   console.log(sandboxes)
 * }
 * ```
 */
export class SandboxPaginator {
  private _hasNext: boolean
  private _nextToken?: string

  private readonly config: ConnectionConfig
  private client: ApiClient

  private query: SandboxListOpts['query']
  private readonly limit?: number

  constructor(opts?: SandboxListOpts) {
    this.config = new ConnectionConfig(opts)
    this.client = new ApiClient(this.config)

    this._hasNext = true
    this._nextToken = opts?.nextToken

    this.query = opts?.query
    this.limit = opts?.limit
  }

  /**
   * Returns True if there are more items to fetch.
   */
  get hasNext(): boolean {
    return this._hasNext
  }

  /**
   * Returns the next token to use for pagination.
   */
  get nextToken(): string | undefined {
    return this._nextToken
  }

  /**
   * Get the next page of sandboxes.
   *
   * @throws Error if there are no more items to fetch. Call this method only if `hasNext` is `true`.
   *
   * @returns List of sandboxes
   */
  async nextItems(): Promise<SandboxInfo[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    let metadata = undefined
    if (this.query?.metadata) {
      const encodedPairs: Record<string, string> = Object.fromEntries(
        Object.entries(this.query.metadata).map(([key, value]) => [
          encodeURIComponent(key),
          encodeURIComponent(value),
        ])
      )

      metadata = new URLSearchParams(encodedPairs).toString()
    }

    const res = await this.client.api.GET('/v2/sandboxes', {
      params: {
        query: {
          metadata,
          state: this.query?.state,
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      // requestTimeoutMs is already passed here via the connectionConfig.
      signal: this.config.getSignal(),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    this._nextToken = res.response.headers.get('x-next-token') || undefined
    this._hasNext = !!this._nextToken

    return (res.data ?? []).map(
      (sandbox: components['schemas']['ListedSandbox']) => ({
        sandboxId: sandbox.sandboxID,
        templateId: sandbox.templateID,
        ...(sandbox.alias && { name: sandbox.alias }),
        metadata: sandbox.metadata ?? {},
        startedAt: new Date(sandbox.startedAt),
        endAt: new Date(sandbox.endAt),
        state: sandbox.state,
        cpuCount: sandbox.cpuCount,
        memoryMB: sandbox.memoryMB,
        envdVersion: sandbox.envdVersion,
      })
    )
  }
}
