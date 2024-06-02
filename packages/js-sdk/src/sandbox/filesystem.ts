import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  Transport,
  PromiseClient,
} from '@connectrpc/connect'

import { ConnectionOpts } from '../connectionConfig'
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
// TODO: Enable using watch as iterable
export class Filesystem {
  private readonly service: PromiseClient<typeof FilesystemService> = createPromiseClient(FilesystemService, this.transport)

  constructor(private readonly transport: Transport) { }

  async list(path: string, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<EntryInfo[]> {
    const params: PlainMessage<ListRequest> = {
      path,
    }

    const res = await this.service.list(params, {
      timeoutMs: opts?.requestTimeoutMs,
    })
    return res.entries
  }

  async remove(path: string, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
    const params: PlainMessage<RemoveRequest> = {
      path,
    }

    await this.service.remove(params, {
      timeoutMs: opts?.requestTimeoutMs,
    })
  }

  async exists(path: string, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<EntryInfo> {
    const params: PlainMessage<StatRequest> = {
      path,
    }

    const res = await this.service.stat(params, {
      timeoutMs: opts?.requestTimeoutMs,
    })
    return res.entry!
  }

  async watch(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>,
  ): Promise<WatchHandle> {
    const params: PlainMessage<WatchRequest> = {
      path,
    }

    const controller = new AbortController()

    const req = this.service.watch(params, {
      signal: controller.signal,
      timeoutMs: opts?.requestTimeoutMs,
    })

    async function processStream() {
      for await (const event of req) {
        if (event.event) {
          await onEvent?.(event.event)
        }
      }
    }

    processStream()

    return {
      stop: () => controller.abort(),
    }
  }
}
