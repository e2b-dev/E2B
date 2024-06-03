import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  Transport,
  PromiseClient,
} from '@connectrpc/connect'

import { ConnectionOpts, defaultUsername, Username } from '../../connectionConfig'
import { EnvdApiClient } from '../../envd/api'
import { FilesystemService } from '../../envd/filesystem/filesystem_connect'
import {
  EntryInfo as FsEntryInfo,
} from '../../envd/filesystem/filesystem_pb'
import { WatchHandle, FilesystemEvent } from './watchHandle'

export type EntryInfo = PlainMessage<FsEntryInfo>

export type FileFormat = 'text' | 'stream' | 'arrayBuffer' | 'blob'

export interface FilesystemRequestOpts extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {
  user?: Username
}

export class Filesystem {
  private readonly rpc: PromiseClient<typeof FilesystemService>
  private readonly envdApi: EnvdApiClient

  constructor(
    transport: Transport,
    envdApiUrl: string,
    private readonly connectionConfig: ConnectionOpts,
  ) {
    this.envdApi = new EnvdApiClient({ apiUrl: envdApiUrl })
    this.rpc = createPromiseClient(FilesystemService, transport)
  }

  async read(path: string, format: 'text', opts?: FilesystemRequestOpts): Promise<string>
  async read(path: string, format: 'arrayBuffer', opts?: FilesystemRequestOpts): Promise<ArrayBuffer>
  async read(path: string, format: 'blob', opts?: FilesystemRequestOpts): Promise<Blob>
  async read(path: string, format: 'stream', opts?: FilesystemRequestOpts): Promise<ReadableStream<Uint8Array>>
  async read(path: string, format: FileFormat = 'text', opts?: FilesystemRequestOpts): Promise<unknown> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const response = await this.envdApi.api.GET('/files/{path}', {
      params: {
        path: {
          path,
          user: opts?.user ?? defaultUsername,
        },
      },
      parseAs: format,
      signal: requestTimeoutMs ? AbortSignal.timeout(requestTimeoutMs) : undefined,
    })

    return response.data
  }

  async write(path: string, data: string, opts?: FilesystemRequestOpts): Promise<void>
  async write(path: string, data: ArrayBuffer, opts?: FilesystemRequestOpts): Promise<void>
  async write(path: string, data: Blob, opts?: FilesystemRequestOpts): Promise<void>
  async write(path: string, data: ReadableStream<Uint8Array>, opts?: FilesystemRequestOpts): Promise<void>
  async write(path: string, data: string | ArrayBuffer | Blob | ReadableStream<Uint8Array>, opts?: FilesystemRequestOpts): Promise<void> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    await this.envdApi.api.PUT('/files/{path}', {
      params: {
        path: {
          path,
        },
        query: {
          user: opts?.user ?? defaultUsername,
        },
      },
      bodySerializer(body) {
        const fd = new FormData()
        for (const name in body) {
          fd.append(name, body[name])
        }
        return fd
      },
      body,
      signal: requestTimeoutMs ? AbortSignal.timeout(requestTimeoutMs) : undefined,
    })
  }

  async list(path: string, opts?: FilesystemRequestOpts): Promise<EntryInfo[]> {
    const res = await this.rpc.list({
      path,
      user: {
        selector: {
          case: 'username',
          value: opts?.user || defaultUsername,
        },
      },
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
    return res.entries
  }

  async remove(path: string, opts?: FilesystemRequestOpts): Promise<void> {
    await this.rpc.remove({
      path,
      user: {
        selector: {
          case: 'username',
          value: opts?.user || defaultUsername,
        },
      },
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
  }

  async exists(path: string, opts?: FilesystemRequestOpts): Promise<EntryInfo> {
    const res = await this.rpc.stat({
      path,
      user: {
        selector: {
          case: 'username',
          value: opts?.user || defaultUsername,
        },
      },
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
    return res.entry!
  }

  async watch(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: FilesystemRequestOpts,
  ): Promise<WatchHandle> {
    const controller = new AbortController()

    const events = this.rpc.watch({
      path,
      user: {
        selector: {
          case: 'username',
          value: opts?.user || defaultUsername,
        },
      },
    }, {
      signal: controller.signal,
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })

    return new WatchHandle(
      () => controller.abort(),
      events,
      onEvent,
    )
  }
}
