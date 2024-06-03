import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  Transport,
  PromiseClient,
} from '@connectrpc/connect'

import { ConnectionOpts, Username } from '../../connectionConfig'
import { EnvdApiClient } from '../../envd/api'
import { FilesystemService } from '../../envd/filesystem/filesystem_connect'
import {
  EntryInfo as FsEntryInfo,
} from '../../envd/filesystem/filesystem_pb'
import { WatchHandle, FilesystemEvent } from './watchHandle'

export type EntryInfo = PlainMessage<FsEntryInfo>

export type FileFormat = 'text' | 'stream' | 'arrayBuffer' | 'blob'

export interface WriteOpts extends Pick<ConnectionOpts, 'requestTimeoutMs'> {
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

  async read(path: string, format: 'text', opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<string>
  async read(path: string, format: 'arrayBuffer', opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<ArrayBuffer>
  async read(path: string, format: 'blob', opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<Blob>
  async read(path: string, format: 'stream', opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<ReadableStream>
  async read(path: string, format: FileFormat = 'text', opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<unknown> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const response = await this.envdApi.api.GET('/files/{path}', {
      params: {
        path: {
          path,
        },
      },
      parseAs: format,
      signal: requestTimeoutMs ? AbortSignal.timeout(requestTimeoutMs) : undefined,
    })

    return response.data
  }

  async write(path: string, data: string, opts?: WriteOpts): Promise<void>
  async write(path: string, data: ArrayBuffer, opts?: WriteOpts): Promise<void>
  async write(path: string, data: Blob, opts?: WriteOpts): Promise<void>
  async write(path: string, data: ReadableStream, opts?: WriteOpts): Promise<void>
  async write(path: string, data: string | ArrayBuffer | Blob | ReadableStream, opts?: WriteOpts): Promise<void> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    await this.envdApi.api.PUT('/files/{path}', {
      params: {
        path: {
          path,
        },
        query: {
          user: opts?.user ?? 'user',
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

  async list(path: string, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<EntryInfo[]> {
    const res = await this.rpc.list({
      path,
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
    return res.entries
  }

  async remove(path: string, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
    await this.rpc.remove({
      path,
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
  }

  async exists(path: string, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<EntryInfo> {
    const res = await this.rpc.stat({
      path
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
    return res.entry!
  }

  async watch(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>,
  ): Promise<WatchHandle> {
    const controller = new AbortController()

    const events = this.rpc.watch({
      path,
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
