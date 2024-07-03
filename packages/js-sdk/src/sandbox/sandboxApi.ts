import { ApiClient, handleApiError } from '../api'
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
  sandboxID: string

  /**
   * Template ID.
   */
  templateID: string

  /**
   * Sandbox name.
   */
  name?: string

  /**
   * Saved sandbox metadata.
   */
  metadata?: Record<string, string>

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
   * @param sandboxID - Sandbox ID.
   * @param opts - Connection options.
   */
  static async kill(sandboxID: string, opts?: SandboxApiOpts): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID,
        },
      },
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

    const res = await client.api.GET('/sandboxes')

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }

    return res.data?.map((sandbox) => ({
      sandboxID: this.getSandboxID(sandbox),
      templateID: sandbox.templateID,
      ...(sandbox.alias && { name: sandbox.alias }),
      ...(sandbox.metadata && { metadata: sandbox.metadata }),
      startedAt: new Date(sandbox.startedAt),
    })) ?? []
  }

  static async setTimeout(sandboxID: string, timeoutMs: number, opts?: SandboxApiOpts): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/timeout', {
      params: {
        path: {
          sandboxID,
        },
      },
      body: {
        timeout: this.timeoutToSeconds(timeoutMs),
      },
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
    }): Promise<string> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes', {
      body: {
        templateID: template,
        metadata: opts?.metadata,
        timeout: this.timeoutToSeconds(timeoutMs),
      },
    })

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }

    if (compareVersions(res.data!.envdVersion, '0.1.0') < 0) {
      await this.kill(this.getSandboxID(res.data!), opts)
      throw new TemplateError(
        'You need to update the template to use the new SDK. ' +
        'You can do this by running `e2b template build` in the directory with the template.'
      )
    }
    return this.getSandboxID(res.data!)
  }

  private static timeoutToSeconds(timeout: number): number {
    return Math.ceil(timeout / 1000)
  }

  private static getSandboxID({ sandboxID, clientID }: { sandboxID: string, clientID: string }): string {
    return `${sandboxID}-${clientID}`
  }
}
