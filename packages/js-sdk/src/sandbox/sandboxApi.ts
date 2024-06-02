import { APIClient, withAPIKey } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'

export interface RunningSandbox {
  sandboxID: string
  templateID: string
  name?: string
  metadata?: Record<string, string>
  startedAt: Date
}

// TODO: Add requestTimeout

export class SandboxApi {
  static async kill(
    sandboxID: string,
    opts: ConnectionOpts = {}
  ): Promise<void> {
    const config = new ConnectionConfig(opts)

    // TODO: Ensure the short id/long id works with kill

    const client = new APIClient(config)
    const killSandbox = withAPIKey(
      client.api.path('/sandboxes/{sandboxID}').method('delete').create(),
    )

    await killSandbox(config.apiKey, { sandboxID })
  }

  static async list(opts: ConnectionOpts = {}): Promise<RunningSandbox[]> {
    const config = new ConnectionConfig(opts)

    const client = new APIClient(config)

    const listSandboxes = withAPIKey(
      client.api.path('/sandboxes').method('get').create(),
    )

    const res = await listSandboxes(config.apiKey, {})

    return res.data.map((sandbox) => ({
      sandboxID: this.getSandboxID(sandbox),
      templateID: sandbox.templateID,
      ...(sandbox.alias && { name: sandbox.alias }),
      ...(sandbox.metadata && { metadata: sandbox.metadata }),
      startedAt: new Date(sandbox.startedAt),
    }))
  }

  protected static async createSandbox(
    template: string,
    opts: ConnectionOpts & {
      metadata?: Record<string, string>,
      timeout?: number,
    } = {}): Promise<string> {
    const config = new ConnectionConfig(opts)

    const client = new APIClient(config)

    const createSandbox = withAPIKey(
      client.api.path('/sandboxes').method('post').create(),
    )

    const res = await createSandbox(config.apiKey, {
      templateID: template,
      metadata: opts.metadata,
      timeout: opts.timeout,
    })

    return this.getSandboxID(res.data)
  }

  protected static async setTimeout(
    sandboxID: string,
    timeout: number,
    opts: ConnectionOpts = {}): Promise<void> {
    const config = new ConnectionConfig(opts)

    const client = new APIClient(config)

    const setSandboxTimeout = withAPIKey(
      client.api.path('/sandboxes/{sandboxID}/timeout').method('post').create(),
    )

    await setSandboxTimeout(config.apiKey, {
      sandboxID,
      timeout,
    })
  }

  private static getSandboxID({ sandboxID, clientID }: { sandboxID: string, clientID: string }): string {
    return `${sandboxID}-${clientID}`
  }
}