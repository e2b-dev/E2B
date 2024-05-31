import { createPromiseClient, PromiseClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

import { FilesystemService } from '../envd/filesystem/v1/filesystem_connect'
import { ProcessService } from '../envd/process/v1/process_connect'

export class SandboxRpc {
  readonly filesystem: PromiseClient<typeof FilesystemService>
  readonly process: PromiseClient<typeof ProcessService>

  constructor(baseUrl: string) {
    const transport = createConnectTransport({
      baseUrl,
    })

    this.filesystem = createPromiseClient(FilesystemService, transport)
    this.process = createPromiseClient(ProcessService, transport)
  }
}
