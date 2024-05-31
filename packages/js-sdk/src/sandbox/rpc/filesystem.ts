import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  Transport,
  PromiseClient,
} from '@connectrpc/connect'

import { FilesystemService } from '../../envd/filesystem/v1/filesystem_connect'
import {
  CopyRequest,
  FilesystemEvent,
  ListDirRequest,
  ListDirResponse,
  RemoveRequest,
  RenameRequest,
  StatRequest,
  StatResponse,
  WatchRequest,
} from '../../envd/filesystem/v1/filesystem_pb'

// TODO: Resolve cwd and provide sane defaults
export class Filesystem {
  private readonly service: PromiseClient<typeof FilesystemService> = createPromiseClient(FilesystemService, this.transport)

  constructor(private readonly transport: Transport) { }

  async copy(params: PlainMessage<CopyRequest>): Promise<void> {
    await this.service.copy(params)
  }

  async createDir(params: PlainMessage<CopyRequest>): Promise<void> {
    await this.service.createDir(params)
  }

  async listDir(params: PlainMessage<ListDirRequest>): Promise<ListDirResponse['entries']> {
    const res = await this.service.listDir(params)
    return res.entries
  }

  async remove(params: PlainMessage<RemoveRequest>): Promise<void> {
    await this.service.remove(params)
  }

  async rename(params: PlainMessage<RenameRequest>): Promise<void> {
    await this.service.rename(params)
  }

  async exists(params: PlainMessage<StatRequest>): Promise<StatResponse['entry']> {
    const res = await this.service.stat(params)
    return res.entry
  }

  async watch(
    params: PlainMessage<WatchRequest>,
    {
      onEvent,
    }: {
      onEvent?: (event: PlainMessage<FilesystemEvent>) => any,
    }
  ): Promise<{ stop: () => void }> {
    const controller = new AbortController()

    const req = this.service.watch(params, {
      signal: controller.signal,
    })

    async function processStream() {
      for await (const event of req) {
        if (event.event) {
          onEvent?.(event.event)
        }
      }
    }

    processStream()

    return {
      stop: () => controller.abort(),
    }
  }
}
