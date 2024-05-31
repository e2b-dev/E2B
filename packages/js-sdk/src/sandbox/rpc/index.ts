import { Transport } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

import { Filesystem } from './filesystem'
import { Process } from './process'

export class SandboxRpc {
  readonly filesystem: Filesystem
  readonly process: Process

  private readonly transport: Transport

  constructor(baseUrl: string) {
    this.transport = createConnectTransport({
      baseUrl,
    })

    this.filesystem = new Filesystem(this.transport)
    this.process = new Process(this.transport)
  }
}
