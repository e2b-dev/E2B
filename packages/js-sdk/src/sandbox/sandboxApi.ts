import { APIClient, APIOpts, withAPIKey } from '../api'
import { getApiKey } from '../utils/apiKey'

export type SandboxMetadata = {
  [key: string]: string
}

export interface RunningSandbox {
  sandboxID: string
  templateID: string
  alias?: string
  metadata?: SandboxMetadata
  startedAt: Date
}

export class SandboxApi {
  static async kill(
    sandboxID: string,
    opts: APIOpts & { apiKey?: string } = {}
  ): Promise<void> {
    const apiKey = getApiKey(opts.apiKey)

    // TODO: Ensure the short id/long id works with kill

    const client = new APIClient(opts)
    const killSandbox = withAPIKey(
      client.api.path('/sandboxes/{sandboxID}').method('delete').create(),
    )

    await killSandbox(apiKey, { sandboxID })
  }

  static async list(opts: APIOpts & { apiKey?: string } = {}): Promise<RunningSandbox[]> {
    const apiKey = getApiKey(opts.apiKey)

    const client = new APIClient(opts)

    const listSandboxes = withAPIKey(
      client.api.path('/sandboxes').method('get').create(),
    )

    const res = await listSandboxes(apiKey, {})

    return res.data.map((sandbox) => ({
      sandboxID: this.getSandboxID(sandbox),
      templateID: sandbox.templateID,
      cpuCount: sandbox.cpuCount,
      memoryMB: sandbox.memoryMB,
      ...(sandbox.alias && { alias: sandbox.alias }),
      ...(sandbox.metadata && { metadata: sandbox.metadata }),
      startedAt: new Date(sandbox.startedAt),
    }))
  }

  protected static async spawn(
    template: string,
    opts: APIOpts & {
      metadata?: SandboxMetadata,
      apiKey?: string,
      timeout?: number,
    } = {}): Promise<string> {
    const apiKey = getApiKey(opts.apiKey)

    const client = new APIClient(opts)

    const createSandbox = withAPIKey(
      client.api.path('/sandboxes').method('post').create(),
    )

    const res = await createSandbox(apiKey, {
      templateID: template,
      metadata: opts.metadata,
      timeout: opts.timeout,
    })

    return this.getSandboxID(res.data)
  }

  protected static async setTimeout(
    sandboxID: string,
    timeout: number,
    opts: APIOpts & {
      apiKey?: string,
    } = {}): Promise<void> {
    const apiKey = getApiKey(opts.apiKey)

    const client = new APIClient(opts)

    const setSandboxTimeout = withAPIKey(
      client.api.path('/sandboxes/{sandboxID}/timeout').method('post').create(),
    )

    await setSandboxTimeout(apiKey, {
      sandboxID,
      duration: timeout,
    })
  }

  private static getSandboxID({ sandboxID, clientID }: { sandboxID: string, clientID: string }): string {
    return `${sandboxID}-${clientID}`
  }
}