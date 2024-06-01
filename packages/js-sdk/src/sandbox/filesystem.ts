import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  Transport,
  PromiseClient,
} from '@connectrpc/connect'

import { FilesystemService } from '../envd/filesystem/v1/filesystem_connect'
import {
  FilesystemEvent as FsFilesystemEvent,
  RemoveRequest,
  StatRequest,
  WatchRequest,
  ListRequest,
  EntryInfo as FsEntryInfo,
} from '../envd/filesystem/v1/filesystem_pb'

export type FilesystemEvent = PlainMessage<FsFilesystemEvent>
export type EntryInfo = PlainMessage<FsEntryInfo>

export interface WatchHandle {
  stop: () => void
}

// TODO: Resolve cwd and provide sane defaults
export class Filesystem {
  private readonly service: PromiseClient<typeof FilesystemService> = createPromiseClient(FilesystemService, this.transport)

  constructor(private readonly transport: Transport) { }

  async list(path: string): Promise<EntryInfo[]> {
    const params: PlainMessage<ListRequest> = {
      path,
    }

    const res = await this.service.list(params)
    return res.entries
  }

  async remove(path: string): Promise<void> {
    const params: PlainMessage<RemoveRequest> = {
      path,
    }

    await this.service.remove(params)
  }

  async exists(path: string): Promise<EntryInfo> {
    const params: PlainMessage<StatRequest> = {
      path,
    }

    const res = await this.service.stat(params)
    return res.entry!
  }

  async watch(
    path: string,
    onEvent: (event: WatchEvent) => any,
  ): Promise<WatchHandle> {
    const params: PlainMessage<WatchRequest> = {
      path,
    }

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
