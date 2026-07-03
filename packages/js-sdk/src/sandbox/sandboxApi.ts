import { ApiClient, components, handleApiError } from '../api'
import {
  ConnectionConfig,
  ConnectionOpts,
  DEFAULT_SANDBOX_TIMEOUT_MS,
} from '../connectionConfig'
import { compareVersions } from 'compare-versions'
import { ALL_TRAFFIC } from './network'
import {
  InvalidArgumentError,
  SandboxNotFoundError,
  TemplateError,
} from '../errors'
import { Paginator } from '../paginator'
import { timeoutToSeconds } from '../utils'
import type { Volume } from '../volume'
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

/**
 * Transform applied to egress requests matching a {@link SandboxNetworkRule}.
 */
export type SandboxNetworkTransform = {
  /**
   * Headers to inject into the outbound request. Values override any headers
   * already present on the request.
   */
  headers?: Record<string, string>
}

/**
 * Per-domain rule applied to egress requests.
 */
export type SandboxNetworkRule = {
  /**
   * Transform applied to requests matching this rule.
   */
  transform?: SandboxNetworkTransform
}

/**
 * Map of host (or CIDR / IP) to ordered list of rules applied to outbound
 * requests for that host. Accepts either a plain object or a `Map`.
 * Registering a host here does not allow egress on its own — the host must
 * also appear in {@link SandboxNetworkOpts.allowOut}.
 */
export type SandboxNetworkRules =
  | Record<string, SandboxNetworkRule[]>
  | Map<string, SandboxNetworkRule[]>

/**
 * Per-domain rule as returned by the sandbox info endpoint. Mirrors
 * {@link SandboxNetworkRule} but with `transform` always materialized to the
 * static {@link SandboxNetworkTransform} shape — no callback variant.
 */
export type SandboxNetworkRuleInfo = {
  transform?: SandboxNetworkTransform
}

/**
 * Context passed to {@link SandboxNetworkOpts.allowOut} and
 * {@link SandboxNetworkOpts.denyOut} when they are defined as functions.
 */
export type SandboxNetworkSelectorContext = {
  /** All traffic sentinel — equivalent to `'0.0.0.0/0'`. */
  allTraffic: string
  /** Rules registered in {@link SandboxNetworkOpts.rules}. */
  rules: Map<string, SandboxNetworkRule[]>
}

/**
 * Egress rule list, either a static array of CIDR blocks / IP addresses /
 * hostnames, or a callback that receives `{ allTraffic, rules }` and returns
 * the same.
 */
export type SandboxNetworkSelector =
  | string[]
  | ((ctx: SandboxNetworkSelectorContext) => string[])

export type SandboxNetworkOpts = {
  /**
   * Allow outbound traffic from the sandbox to the specified addresses.
   * If `allowOut` is not specified, all outbound traffic is allowed.
   *
   * Accepts either a static array of CIDR blocks, IP addresses, or hostnames,
   * or a callback that receives `{ allTraffic, rules }` and returns the same.
   * `allTraffic` is `'0.0.0.0/0'`; `rules` is a `Map` view of
   * {@link SandboxNetworkOpts.rules}.
   *
   * Examples:
   * - Static list: `["1.1.1.1", "8.8.8.0/24"]`
   * - Allow only rule-registered hosts:
   *   `({ rules }) => [...rules.keys()]`
   */
  allowOut?: SandboxNetworkSelector

  /**
   * Deny outbound traffic from the sandbox to the specified addresses.
   *
   * Accepts the same shapes as {@link allowOut}.
   *
   * Examples:
   * - Static list: `["1.1.1.1", "8.8.8.0/24"]`
   * - Block all egress: `({ allTraffic }) => [allTraffic]`
   */
  denyOut?: SandboxNetworkSelector

  /**
   * Per-domain transform rules applied to matching egress HTTP/HTTPS
   * requests. Keys are domains (e.g. `"api.example.com"`); values are
   * ordered lists of rules.
   *
   * Registering a host here does not allow egress on its own — the host must
   * also appear in {@link allowOut}. Hosts registered here are exposed to the
   * `allowOut`/`denyOut` callbacks via `rules`.
   *
   * @example
   * ```ts
   * await Sandbox.create({
   *   network: {
   *     allowOut: ({ rules }) => [...rules.keys()],
   *     rules: {
   *       'api.openai.com': [
   *         { transform: { headers: { Authorization: `Bearer ${token}` } } },
   *       ],
   *     },
   *   },
   * })
   * ```
   */
  rules?: SandboxNetworkRules

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
 * Network configuration as returned by the sandbox info endpoint. Mirrors
 * {@link SandboxNetworkOpts} but with `allowOut`/`denyOut` always materialized
 * to plain string arrays.
 */
export type SandboxNetworkInfo = {
  allowOut?: string[]
  denyOut?: string[]
  rules?: Record<string, SandboxNetworkRuleInfo[]>
  allowPublicTraffic?: boolean
  maskRequestHost?: string
}

/**
 * Subset of {@link SandboxNetworkOpts} accepted by {@link SandboxApi.updateNetwork}.
 * The update endpoint replaces all egress rules atomically — fields that are
 * omitted are cleared on the server.
 */
export type SandboxNetworkUpdate = {
  /** See {@link SandboxNetworkOpts.allowOut}. */
  allowOut?: SandboxNetworkSelector
  /** See {@link SandboxNetworkOpts.denyOut}. */
  denyOut?: SandboxNetworkSelector
  /** See {@link SandboxNetworkOpts.rules}. */
  rules?: SandboxNetworkRules
  /**
   * Allow sandbox to access the internet. When set to `false`, it behaves the
   * same as specifying `denyOut: ['0.0.0.0/0']` in the network config.
   */
  allowInternetAccess?: boolean
}

/**
 * What happens when the sandbox timeout is reached. Either the bare action
 * (`'pause'` / `'kill'`), or an object form that also controls the pause
 * snapshot kind via `keepMemory`.
 *
 * The object form is a discriminated union on `action`: `keepMemory` is only
 * accepted alongside `action: 'pause'`. Passing `keepMemory` with
 * `action: 'kill'` is a compile-time type error.
 */
export type SandboxOnTimeout =
  | 'pause'
  | 'kill'
  | {
      /** Auto-pause the sandbox when the timeout is reached. */
      action: 'pause'

      /**
       * Whether the timeout auto-pause keeps a full memory snapshot.
       *
       * When `false`, the auto-pause drops the in-memory state and persists only
       * the filesystem (a filesystem-only snapshot); resuming such a sandbox
       * cold-boots (reboots) it from disk, losing running processes and open
       * connections.
       *
       * Cannot be combined with `autoResume`: auto-resume wakes a paused sandbox
       * on inbound traffic by restoring its memory snapshot in place, so the
       * request that woke it hits an already-running process. A filesystem-only
       * snapshot has no memory to restore — resuming cold-boots it — so it can't
       * be woken transparently by traffic and must be resumed explicitly via
       * `connect()`.
       *
       * @default true
       */
      keepMemory?: boolean
    }
  | {
      /** Kill the sandbox when the timeout is reached. */
      action: 'kill'
    }

export type SandboxLifecycle = {
  /**
   * Action to take when sandbox timeout is reached. Accepts either `'pause'` /
   * `'kill'`, or `{ action, keepMemory }` to also control the pause snapshot kind.
   * @default "kill"
   */
  onTimeout: SandboxOnTimeout

  /**
   * Auto-resume enabled flag.
   * @default false
   * Can be `true` only when `onTimeout` is `pause`. Not supported when
   * `keepMemory` is `false` (a filesystem-only snapshot must be resumed
   * explicitly via `connect()`).
   */
  autoResume?: boolean
}

export type SandboxInfoLifecycle = {
  /**
   * Action to take when sandbox timeout is reached.
   */
  onTimeout: 'pause' | 'kill'

  /**
   * Whether the sandbox can auto-resume.
   */
  autoResume: boolean
}

/**
 * Options for request to the Sandbox API.
 */
export interface SandboxApiOpts
  extends Partial<
    Pick<
      ConnectionOpts,
      | 'apiKey'
      | 'validateApiKey'
      | 'headers'
      | 'apiHeaders'
      | 'debug'
      | 'domain'
      | 'requestTimeoutMs'
      | 'signal'
    >
  > {}

/**
 * Options for pausing a sandbox.
 */
export interface SandboxPauseOpts extends SandboxApiOpts {
  /**
   * Whether to keep a full memory snapshot.
   *
   * When `false`, the in-memory state is dropped and only the filesystem is
   * persisted (a filesystem-only snapshot); resuming such a sandbox cold-boots
   * (reboots) it from disk, losing running processes and open connections.
   *
   * @default true
   */
  keepMemory?: boolean
}

/**
 * Options for creating a new Sandbox.
 */
export interface SandboxOpts extends ConnectionOpts {
  /**
   * Sandbox template name or ID.
   *
   * @default 'base' (or 'mcp-gateway' when `mcp` option is set)
   */
  template?: string

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
   * Volume mounts for the sandbox.
   *
   * The keys are mount paths inside the sandbox and the values are either
   * a `Volume` instance or a string representing the volume name.
   *
   * @default undefined
   */
  volumeMounts?: Record<string, Volume | string>

  /**
   * Sandbox URL. Used for local development
   */
  sandboxUrl?: string

  /**
   * Sandbox lifecycle configuration.
   */
  lifecycle?: SandboxLifecycle
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

export interface SandboxListOpts extends Omit<SandboxApiOpts, 'signal'> {
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
  start?: Date
  /**
   * End time for the metrics, defaults to the current time
   */
  end?: Date
}

/**
 * Options for listing snapshots.
 */
export interface SnapshotListOpts extends Omit<SandboxApiOpts, 'signal'> {
  /**
   * Filter snapshots by source sandbox ID.
   *
   * Mutually exclusive with `name`.
   */
  sandboxId?: string

  /**
   * Filter snapshots by name or ID, optionally tag-qualified
   * (e.g. "my-snapshot", "my-team/my-snapshot" or "my-snapshot:v1").
   *
   * Mutually exclusive with `sandboxId`.
   */
  name?: string

  /**
   * Number of snapshots to return per page.
   *
   * @default 100
   */
  limit?: number

  /**
   * Token to the next page.
   */
  nextToken?: string
}

/**
 * Information about a snapshot.
 */
export interface SnapshotInfo {
  /**
   * Snapshot identifier — template ID with tag, or namespaced name with tag (e.g. my-snapshot:latest).
   * Can be used with Sandbox.create() to create a new sandbox from this snapshot.
   */
  snapshotId: string

  /**
   * Full names of the snapshot template including team namespace and tag (e.g. team-slug/my-snapshot:v2).
   */
  names: string[]
}

/**
 * Options for creating a snapshot.
 */
export interface CreateSnapshotOpts extends SandboxApiOpts {
  /**
   * Optional name for the snapshot template.
   * If a snapshot template with this name already exists, a new build will be assigned
   * to the existing template instead of creating a new one.
   */
  name?: string
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

  /**
   * Whether internet access was explicitly enabled or disabled for the sandbox.
   */
  allowInternetAccess?: boolean | undefined

  /**
   * Sandbox network configuration.
   */
  network?: SandboxNetworkInfo

  /**
   * Sandbox lifecycle configuration.
   */
  lifecycle?: SandboxInfoLifecycle

  /**
   * Volume mounts for the sandbox.
   */
  volumeMounts?: Array<{ name: string; path: string }>

  /**
   * Sandbox domain.
   */
  sandboxDomain?: string
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
   * Cached memory (page cache) in bytes.
   */
  memCache: number

  /**
   * Used disk space in bytes.
   */
  diskUsed: number

  /**
   * Total disk space available in bytes.
   */
  diskTotal: number
}

function resolveNetworkSelector(
  selector: SandboxNetworkSelector | undefined,
  rules: Map<string, SandboxNetworkRule[]>
): string[] | undefined {
  if (selector === undefined) {
    return undefined
  }

  if (typeof selector === 'function') {
    return selector({ allTraffic: ALL_TRAFFIC, rules })
  }

  return selector
}

function resolveRulesForBody(
  rules: Map<string, SandboxNetworkRule[]>
): Record<string, { transform?: SandboxNetworkTransform }[]> {
  const out: Record<string, { transform?: SandboxNetworkTransform }[]> = {}
  for (const [host, hostRules] of rules) {
    out[host] = hostRules.map((rule) =>
      rule.transform === undefined ? {} : { transform: rule.transform }
    )
  }
  return out
}

type NetworkEgressBody = {
  allowOut?: string[]
  denyOut?: string[]
  rules?: Record<string, { transform?: SandboxNetworkTransform }[]>
}

function buildNetworkEgress(network: {
  allowOut?: SandboxNetworkSelector
  denyOut?: SandboxNetworkSelector
  rules?: SandboxNetworkRules
}): NetworkEgressBody {
  const rules =
    network.rules instanceof Map
      ? network.rules
      : new Map(Object.entries(network.rules ?? {}))
  const allowOut = resolveNetworkSelector(network.allowOut, rules)
  const denyOut = resolveNetworkSelector(network.denyOut, rules)

  return {
    ...(allowOut !== undefined ? { allowOut } : {}),
    ...(denyOut !== undefined ? { denyOut } : {}),
    ...(network.rules !== undefined
      ? { rules: resolveRulesForBody(rules) }
      : {}),
  }
}

function buildNetworkBody(
  network: SandboxNetworkOpts | undefined
): components['schemas']['SandboxNetworkConfig'] | undefined {
  if (!network) {
    return undefined
  }

  return {
    ...buildNetworkEgress(network),
    ...(network.allowPublicTraffic !== undefined
      ? { allowPublicTraffic: network.allowPublicTraffic }
      : {}),
    ...(network.maskRequestHost !== undefined
      ? { maskRequestHost: network.maskRequestHost }
      : {}),
  }
}

function buildNetworkUpdateBody(
  network: SandboxNetworkUpdate
): components['schemas']['SandboxNetworkUpdateConfig'] {
  return {
    ...buildNetworkEgress(network),
    ...(network.allowInternetAccess !== undefined
      ? { allow_internet_access: network.allowInternetAccess }
      : {}),
  }
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

    if (config.debug) {
      // Skip killing the sandbox in debug mode
      return true
    }

    const client = new ApiClient(config)

    const res = await client.api.DELETE('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
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
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Sandbox ${sandboxId} not found`)
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
      allowInternetAccess: res.data.allowInternetAccess ?? undefined,
      envdVersion: res.data.envdVersion,
      startedAt: new Date(res.data.startedAt),
      endAt: new Date(res.data.endAt),
      state: res.data.state,
      cpuCount: res.data.cpuCount,
      memoryMB: res.data.memoryMB,
      network: res.data.network
        ? {
            allowOut: res.data.network.allowOut,
            denyOut: res.data.network.denyOut,
            rules: res.data.network.rules ?? undefined,
            allowPublicTraffic: res.data.network.allowPublicTraffic,
            maskRequestHost: res.data.network.maskRequestHost,
          }
        : undefined,
      lifecycle: res.data.lifecycle
        ? {
            onTimeout: res.data.lifecycle.onTimeout,
            autoResume: res.data.lifecycle.autoResume,
          }
        : undefined,
      sandboxDomain: res.data.domain || undefined,
      volumeMounts: res.data.volumeMounts ?? [],
    }
  }

  /**
   * @deprecated Use {@link Sandbox.getInfo} instead.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns sandbox information.
   */
  static async getFullInfo(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<SandboxInfo> {
    return await this.getInfo(sandboxId, opts)
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

    if (config.debug) {
      // Skip getting the metrics in debug mode
      return []
    }

    const client = new ApiClient(config)

    // JS timestamp is in milliseconds, convert to unix (seconds)
    const start = opts?.start
      ? Math.round(opts.start.getTime() / 1000)
      : undefined
    const end = opts?.end ? Math.round(opts.end.getTime() / 1000) : undefined
    const res = await client.api.GET('/sandboxes/{sandboxID}/metrics', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
        query: {
          start,
          end,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Sandbox ${sandboxId} not found`)
    }

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
        memCache: metric.memCache,
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
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Sandbox ${sandboxId} not found`)
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }
  }

  /**
   * Update the network configuration of a running sandbox.
   *
   * Replaces the current egress configuration atomically — fields that are
   * omitted are cleared on the server.
   *
   * @param sandboxId sandbox ID.
   * @param network new network configuration.
   * @param opts connection options.
   */
  static async updateNetwork(
    sandboxId: string,
    network: SandboxNetworkUpdate,
    opts?: SandboxApiOpts
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.PUT('/sandboxes/{sandboxID}/network', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: buildNetworkUpdateBody(network),
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Sandbox ${sandboxId} not found`)
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }
  }

  /**
   * Pause the sandbox specified by sandbox ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts pause options, including `keepMemory` and connection options.
   *
   * @returns `true` if the sandbox got paused, `false` if the sandbox was already paused.
   */
  static async pause(
    sandboxId: string,
    opts?: SandboxPauseOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/pause', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: {
        memory: opts?.keepMemory ?? true,
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Sandbox ${sandboxId} not found`)
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

  /**
   * @deprecated Use {@link SandboxApi.pause} instead.
   */
  static async betaPause(
    sandboxId: string,
    opts?: SandboxPauseOpts
  ): Promise<boolean> {
    return this.pause(sandboxId, opts)
  }

  /**
   * Create a snapshot from a sandbox.
   *
   * The sandbox will be paused while the snapshot is being created.
   * The snapshot can be used to create new sandboxes with the same state.
   * The snapshot is a persistent image that survives sandbox deletion.
   *
   * @param sandboxId sandbox ID to create snapshot from.
   * @param opts snapshot creation options including optional name and connection options.
   *
   * @returns snapshot information including the snapshot name that can be used with Sandbox.create().
   */
  static async createSnapshot(
    sandboxId: string,
    opts?: CreateSnapshotOpts
  ): Promise<SnapshotInfo> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/snapshots', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: opts?.name ? { name: opts.name } : {},
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Sandbox ${sandboxId} not found`)
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return {
      snapshotId: res.data!.snapshotID,
      names: res.data!.names ?? [],
    }
  }

  /**
   * List all snapshots.
   *
   * @param opts list options including filters and pagination.
   *
   * @returns paginator for listing snapshots.
   */
  static listSnapshots(opts?: SnapshotListOpts): SnapshotPaginator {
    return new SnapshotPaginator(opts)
  }

  /**
   * Delete a snapshot.
   *
   * @param snapshotId snapshot ID.
   * @param opts connection options.
   *
   * @returns `true` if the snapshot was deleted, `false` if it was not found.
   */
  static async deleteSnapshot(
    snapshotId: string,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/templates/{templateID}', {
      params: {
        path: {
          templateID: snapshotId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
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

  protected static async createSandbox(
    template: string,
    timeoutMs: number,
    opts?: SandboxOpts
  ) {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)
    // onTimeout accepts a bare action (`'pause'` / `'kill'`) or the object form
    // `{ action, keepMemory }`. The discriminated union type forbids `keepMemory`
    // on `action: 'kill'`; re-check at runtime for untyped (JS) callers.
    const onTimeout = opts?.lifecycle?.onTimeout ?? 'kill'
    const action = typeof onTimeout === 'string' ? onTimeout : onTimeout.action
    const hasKeepMemory =
      typeof onTimeout !== 'string' && 'keepMemory' in onTimeout
    const keepMemory =
      typeof onTimeout !== 'string' && 'keepMemory' in onTimeout
        ? (onTimeout.keepMemory ?? true)
        : true
    const autoResume = opts?.lifecycle?.autoResume ?? false

    if (hasKeepMemory && action !== 'pause') {
      throw new InvalidArgumentError(
        "onTimeout.keepMemory is only allowed when action is 'pause'."
      )
    }

    if (autoResume && action !== 'pause') {
      throw new InvalidArgumentError(
        "autoResume can only be true when onTimeout action is 'pause'."
      )
    }

    if (!keepMemory && autoResume) {
      throw new InvalidArgumentError(
        'autoResume: true is not a valid value when keepMemory: false - a filesystem-only snapshot cannot be auto-resumed by traffic and must be resumed explicitly using Sandbox.connect().'
      )
    }

    const body: components['schemas']['NewSandbox'] = {
      templateID: template,
      metadata: opts?.metadata,
      mcp: opts?.mcp as Record<string, unknown> | undefined,
      envVars: opts?.envs,
      timeout: timeoutToSeconds(timeoutMs),
      secure: opts?.secure ?? true,
      allow_internet_access: opts?.allowInternetAccess ?? true,
      network: buildNetworkBody(opts?.network),
      autoPause: action === 'pause',
      autoPauseMemory: action === 'pause' ? keepMemory : undefined,
      autoResume: { enabled: autoResume },
    }

    if (opts?.volumeMounts) {
      body.volumeMounts = Object.entries(opts.volumeMounts).map(
        ([mountPath, vol]) => ({
          name: typeof vol === 'string' ? vol : vol.name,
          path: mountPath,
        })
      )
    }

    const res = await client.api.POST('/sandboxes', {
      body,
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    if (compareVersions(res.data!.envdVersion, '0.1.0') < 0) {
      await this.kill(res.data!.sandboxID, opts)
      throw new TemplateError(
        'You need to update the template to use the new SDK.'
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
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.error?.code === 404) {
      throw new SandboxNotFoundError(`Paused sandbox ${sandboxId} not found`)
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
 * while (paginator.hasNext) {
 *   const sandboxes = await paginator.nextItems()
 *   console.log(sandboxes)
 * }
 * ```
 */
export class SandboxPaginator extends Paginator<SandboxInfo, SandboxApiOpts> {
  private query: SandboxListOpts['query']

  constructor(opts?: SandboxListOpts) {
    super(opts, opts?.limit, opts?.nextToken)

    this.query = opts?.query
  }

  async nextItems(opts?: SandboxApiOpts): Promise<SandboxInfo[]> {
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

    const config = new ConnectionConfig({ ...this.opts, ...opts })
    const client = new ApiClient(config)

    const res = await client.api.GET('/v2/sandboxes', {
      params: {
        query: {
          metadata,
          state: this.query?.state,
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

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
        volumeMounts: sandbox.volumeMounts ?? [],
      })
    )
  }
}

/**
 * Paginator for listing snapshots.
 *
 * @example
 * ```ts
 * const paginator = Sandbox.listSnapshots()
 * while (paginator.hasNext) {
 *   const snapshots = await paginator.nextItems()
 *   console.log(snapshots)
 * }
 * ```
 */
export class SnapshotPaginator extends Paginator<SnapshotInfo, SandboxApiOpts> {
  private readonly sandboxId?: string
  private readonly name?: string

  constructor(opts?: SnapshotListOpts) {
    super(opts, opts?.limit, opts?.nextToken)

    if (opts?.sandboxId && opts?.name) {
      throw new Error(
        'listSnapshots accepts either `sandboxId` or `name`, not both.'
      )
    }

    this.sandboxId = opts?.sandboxId
    this.name = opts?.name
  }

  async nextItems(opts?: SandboxApiOpts): Promise<SnapshotInfo[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    const config = new ConnectionConfig({ ...this.opts, ...opts })
    const client = new ApiClient(config)

    const res = await client.api.GET('/snapshots', {
      params: {
        query: {
          sandboxID: this.sandboxId,
          name: this.name,
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

    return (res.data ?? []).map(
      (snapshot: components['schemas']['SnapshotInfo']) => ({
        snapshotId: snapshot.snapshotID,
        names: snapshot.names ?? [],
      })
    )
  }
}
