import { ApiClient, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'


export interface RunningSandbox {
  sandboxID: string
  templateID: string
  name?: string
  metadata?: Record<string, string>
  startedAt: Date
}

export class SandboxApi {
  protected constructor() { }

  static async kill(
    sandboxID: string,
    opts?: ConnectionOpts,
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID,
        },
      },
    })

    const err = handleApiError(res.error)
    if (err) {
      throw err
    }
  }

  static async list(opts?: ConnectionOpts): Promise<RunningSandbox[]> {
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

  protected static async createSandbox(
    template: string,
    timeoutMs: number,
    opts?: ConnectionOpts & {
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

    return this.getSandboxID(res.data!)
  }

  protected static async setTimeout(
    sandboxID: string,
    timeoutMs: number,
    opts?: ConnectionOpts,
  ): Promise<void> {
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

  private static timeoutToSeconds(timeout: number): number {
    return Math.ceil(timeout / 1000)
  }

  private static getSandboxID({ sandboxID, clientID }: { sandboxID: string, clientID: string }): string {
    return `${sandboxID}-${clientID}`
  }
}
