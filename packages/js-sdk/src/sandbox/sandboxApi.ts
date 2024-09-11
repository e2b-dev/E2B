import { ApiClient, components, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { compareVersions } from 'compare-versions'
import { TemplateError } from '../errors'

export interface SandboxApiOpts extends Partial<Pick<ConnectionOpts, 'apiKey' | 'debug' | 'domain' | 'requestTimeoutMs'>> { }

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
   * Sandbox name.
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
}

export class SandboxApi {
  protected constructor() { }

  /**
   * Kills sandbox specified by sandbox ID.
   *
   * @param sandboxId - Sandbox ID.
   * @param opts - Connection options.
   */
  static async kill(sandboxId: string, opts?: SandboxApiOpts): Promise<boolean> {
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

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }

    return true
  }

  static async list(opts?: SandboxApiOpts): Promise<SandboxInfo[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes', {
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }

    return res.data?.map((sandbox: components['schemas']['RunningSandbox']) => ({
      sandboxId: this.getSandboxId({ sandboxId: sandbox.sandboxID, clientId: sandbox.clientID }),
      templateId: sandbox.templateID,
      ...(sandbox.alias && { name: sandbox.alias }),
      metadata: sandbox.metadata ?? {},
      startedAt: new Date(sandbox.startedAt),
    })) ?? []
  }

  static async setTimeout(sandboxId: string, timeoutMs: number, opts?: SandboxApiOpts): Promise<void> {
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

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }
  }

  protected static async createSandbox(
    template: string,
    timeoutMs: number,
    opts?: SandboxApiOpts & {
      metadata?: Record<string, string>,
      envs?: Record<string, string>,
    }): Promise<string> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes', {
      body: {
        templateID: template,
        metadata: opts?.metadata,
        envVars: opts?.envs,
        timeout: this.timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }

    if (compareVersions(res.data!.envdVersion, '0.1.0') < 0) {
      await this.kill(this.getSandboxId({ sandboxId: res.data!.sandboxID, clientId: res.data!.clientID }), opts)
      throw new TemplateError(
        'You need to update the template to use the new SDK. ' +
        'You can do this by running `e2b template build` in the directory with the template.'
      )
    }
    return this.getSandboxId({ sandboxId: res.data!.sandboxID, clientId: res.data!.clientID })
  }

  private static timeoutToSeconds(timeout: number): number {
    return Math.ceil(timeout / 1000)
  }

  private static getSandboxId({ sandboxId, clientId }: { sandboxId: string, clientId: string }): string {
    return `${sandboxId}-${clientId}`
  }
}
