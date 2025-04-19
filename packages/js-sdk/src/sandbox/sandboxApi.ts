import { ApiClient, components, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { compareVersions } from 'compare-versions'
import { TemplateError } from '../errors'

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

export interface SandboxListOpts extends SandboxApiOpts {
  /**
   * Filter the list of sandboxes, e.g. by metadata `metadata:{"key": "value"}`, if there are multiple filters they are combined with AND.
   */
  query?: { metadata?: Record<string, string> }
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
   * Envd access token.
   */
  envdAccessToken?: string

  /**
   * Envd version.
   */
  envdVersion?: string

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
   * List all running sandboxes.
   *
   * @param opts connection options.
   *
   * @returns list of running sandboxes.
   */
  static async list(opts?: SandboxListOpts): Promise<SandboxInfo[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    let metadata = undefined
    if (opts?.query) {
      if (opts.query.metadata) {
        const encodedPairs: Record<string, string> = Object.fromEntries(
          Object.entries(opts.query.metadata).map(([key, value]) => [
            encodeURIComponent(key),
            encodeURIComponent(value),
          ])
        )
        metadata = new URLSearchParams(encodedPairs).toString()
      }
    }

    const res = await client.api.GET('/sandboxes', {
      params: {
        query: { metadata },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return (
      res.data?.map((sandbox: components['schemas']['ListedSandbox']) => ({
        sandboxId: this.getSandboxId({
          sandboxId: sandbox.sandboxID,
          clientId: sandbox.clientID,
        }),
        templateId: sandbox.templateID,
        ...(sandbox.alias && { name: sandbox.alias }),
        metadata: sandbox.metadata ?? {},
        startedAt: new Date(sandbox.startedAt),
        endAt: new Date(sandbox.endAt),
      })) ?? []
    )
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
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Sandbox not found')
    }

    return {
      sandboxId: this.getSandboxId({
        sandboxId: res.data.sandboxID,
        clientId: res.data.clientID,
      }),
      templateId: res.data.templateID,
      ...(res.data.alias && { name: res.data.alias }),
      metadata: res.data.metadata ?? {},
      envdVersion: res.data.envdVersion,
      envdAccessToken: res.data.envdAccessToken,
      startedAt: new Date(res.data.startedAt),
      endAt: new Date(res.data.endAt),
    }
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

  protected static async createSandbox(
    template: string,
    timeoutMs: number,
    opts?: SandboxApiOpts & {
      metadata?: Record<string, string>
      envs?: Record<string, string>
      secure?: boolean
    }
  ): Promise<{
    sandboxId: string
    envdVersion: string
    envdAccessToken?: string
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
        secure: opts?.secure,
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
      envdAccessToken: res.data!.envdAccessToken
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
