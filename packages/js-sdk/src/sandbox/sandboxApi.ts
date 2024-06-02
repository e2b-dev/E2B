import { ApiClient } from '../api'
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

    // TODO: Ensure the short id/long id works
    // TODO: Check if the errors are thrown properly

    await client.api.DELETE('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID,
        },
      },
    })
  }

  static async list(opts?: ConnectionOpts): Promise<RunningSandbox[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes')

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
    opts?: ConnectionOpts & {
      metadata?: Record<string, string>,
      timeout?: number,
    }): Promise<string> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes', {
      body: {
        templateID: template,
        metadata: opts?.metadata,
        timeout: opts?.timeout,
      },
    })

    return this.getSandboxID(res.data!)
  }

  protected static async setTimeout(
    sandboxID: string,
    timeoutMs: number,
    opts?: ConnectionOpts,
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    // TODO: Ensure the short id/long id works

    await client.api.POST('/sandboxes/{sandboxID}/timeout', {
      params: {
        path: {
          sandboxID,
        },
      },
      body: {
        timeout: timeoutMs,
      },
    })
  }

  private static getSandboxID({ sandboxID, clientID }: { sandboxID: string, clientID: string }): string {
    return `${sandboxID}-${clientID}`
  }
}
