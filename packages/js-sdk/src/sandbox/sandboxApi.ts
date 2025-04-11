import { compareVersions } from 'compare-versions'
import { ApiClient, components, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { NotFoundError, TemplateError } from '../errors'

/**
 * Options for request to the Sandbox API.
 */
export interface SandboxApiOpts
  extends Partial<
    Pick<ConnectionOpts, 'apiKey' | 'debug' | 'domain' | 'requestTimeoutMs'>
  > {}

export interface SandboxListOpts extends SandboxApiOpts {
  /**
   * Filter the list of sandboxes, e.g. by metadata `metadata:{"key": "value"}`, if there are multiple filters they are combined with AND.
   */
  query?: {
    metadata?: Record<string, string>
    /**
     * Filter the list of sandboxes by state.
     */
    state?: Array<'running' | 'paused'>
  }

  /**
   * Number of sandboxes to return.
   */
  limit?: number

  /**
   * Token to the next page.
   */
  nextToken?: string
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
   * Sandbox state.
   */
  state: 'running' | 'paused'
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
   * List all sandboxes.
   *
   * @param opts connection options.
   *
   * @returns list of sandboxes.
   */
  static async list(opts: SandboxListOpts = {}): Promise<{
    sandboxes: SandboxInfo[]
    hasMoreItems: boolean
    nextToken: string | undefined
    iterator: AsyncGenerator<SandboxInfo>
  }> {
    const { query, limit, nextToken, requestTimeoutMs } = opts
    const config = new ConnectionConfig({ requestTimeoutMs })
    const client = new ApiClient(config)

    let metadata = undefined
    if (query) {
      if (query.metadata) {
        const encodedPairs: Record<string, string> = Object.fromEntries(
          Object.entries(query.metadata).map(([key, value]) => [
            encodeURIComponent(key),
            encodeURIComponent(value),
          ])
        )
        metadata = new URLSearchParams(encodedPairs).toString()
      }
    }

    const res = await client.api.GET('/v2/sandboxes', {
      params: {
        query: {
          metadata,
          state: query?.state,
          limit,
          nextToken,
        },
      },
      signal: config.getSignal(requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    const nextPageToken = res.response.headers.get('x-next-token') || undefined
    const hasMoreItems = !!nextPageToken

    const sandboxes = (res.data ?? []).map(
      (sandbox: components['schemas']['ListedSandbox']) => ({
        sandboxId: this.getSandboxId({
          sandboxId: sandbox.sandboxID,
          clientId: sandbox.clientID,
        }),
        templateId: sandbox.templateID,
        ...(sandbox.alias && { name: sandbox.alias }),
        metadata: sandbox.metadata ?? {},
        startedAt: new Date(sandbox.startedAt),
        state: sandbox.state,
      })
    )

    return {
      sandboxes,
      hasMoreItems,
      nextToken: nextPageToken,
      iterator: this.listIterator({
        limit,
        nextToken: nextPageToken,
        query,
        requestTimeoutMs,
      }),
    }
  }

  private static async *listIterator(
    options: SandboxListOpts = {}
  ): AsyncGenerator<SandboxInfo> {
    let nextPage = true
    let token = options.nextToken

    while (nextPage) {
      const { sandboxes, hasMoreItems, nextToken } = await this.list({
        ...options,
        nextToken: token,
      })

      nextPage = hasMoreItems
      token = nextToken

      for (const sandbox of sandboxes) {
        yield sandbox
      }
    }
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns metrics of the sandbox.
   */
  static async getMetrics(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<components['schemas']['SandboxMetric'][]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes/{sandboxID}/metrics', {
      params: {
        path: {
          sandboxID: sandboxId,
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
        ...metric,
        timestamp: new Date(metric.timestamp).toISOString(),
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
        timeout: this.timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
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
  protected static async pauseSandbox(
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

  protected static async resumeSandbox(
    sandboxId: string,
    timeoutMs: number,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/resume', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: {
        autoPause: false,
        timeout: this.timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Paused sandbox ${sandboxId} not found`)
    }

    if (res.error?.code === 409) {
      // Sandbox is already running
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
    opts?: SandboxApiOpts & {
      metadata?: Record<string, string>
      envs?: Record<string, string>
    }
  ): Promise<{
    sandboxId: string
    envdVersion: string
  }> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes', {
      body: {
        autoPause: false,
        templateID: template,
        metadata: opts?.metadata,
        envVars: opts?.envs,
        timeout: this.timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    if (compareVersions(res.data!.envdVersion, '0.1.0') < 0) {
      await this.kill(
        this.getSandboxId({
          sandboxId: res.data!.sandboxID,
          clientId: res.data!.clientID,
        }),
        opts
      )
      throw new TemplateError(
        'You need to update the template to use the new SDK. ' +
          'You can do this by running `e2b template build` in the directory with the template.'
      )
    }
    return {
      sandboxId: this.getSandboxId({
        sandboxId: res.data!.sandboxID,
        clientId: res.data!.clientID,
      }),
      envdVersion: res.data!.envdVersion,
    }
  }

  private static timeoutToSeconds(timeout: number): number {
    return Math.ceil(timeout / 1000)
  }

  private static getSandboxId({
    sandboxId,
    clientId,
  }: {
    sandboxId: string
    clientId: string
  }): string {
    return `${sandboxId}-${clientId}`
  }
}
