import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  Transport,
  PromiseClient,
} from '@connectrpc/connect'

import { FilesystemService } from '../../envd/filesystem/v1/filesystem_connect'
import {
  FilesystemEvent,
  RemoveRequest,
  StatRequest,
  StatResponse,
  ListRequest,
  ListResponse,
  WatchRequest,
} from '../../envd/filesystem/v1/filesystem_pb'

// TODO: Resolve cwd and provide sane defaults
export class Filesystem {
  private readonly service: PromiseClient<typeof FilesystemService> = createPromiseClient(FilesystemService, this.transport)

  constructor(private readonly transport: Transport) { }

  async list(params: PlainMessage<ListRequest>): Promise<ListResponse['entries']> {
    const res = await this.service.list(params)
    return res.entries
  }

  async remove(params: PlainMessage<RemoveRequest>): Promise<void> {
    await this.service.remove(params)
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
