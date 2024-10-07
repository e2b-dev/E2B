import { Code, ConnectError, createPromiseClient, PromiseClient, Transport } from '@connectrpc/connect'
import {
  ConnectionConfig,
  ConnectionOpts,
  defaultUsername,
  KEEPALIVE_PING_HEADER,
  KEEPALIVE_PING_INTERVAL_SEC,
  Username,
} from '../../connectionConfig'

import { handleEnvdApiError } from '../../envd/api'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'

import { EnvdApiClient } from '../../envd/api'
import { Filesystem as FilesystemService } from '../../envd/filesystem/filesystem_connect'
import { EntryInfo, FileType as FsFileType } from '../../envd/filesystem/filesystem_pb'

import { FilesystemEvent, WatchHandle } from './watchHandle'
import { clearTimeout } from 'timers'

export interface EntryInfo {
  name: string
  type?: FileType
  path: string
}

export const enum FileType {
  FILE = 'file',
  DIR = 'dir',
}

export type WriteData = string | ArrayBuffer | Blob | ReadableStream

function mapFileType(fileType: FsFileType) {
  switch (fileType) {
    case FsFileType.DIRECTORY:
      return FileType.DIR
    case FsFileType.FILE:
      return FileType.FILE
  }
}

export interface FilesystemRequestOpts extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {
  user?: Username
}

export interface WatchOpts extends FilesystemRequestOpts {
  timeout?: number
  onExit?: (err: Error) => void
}

export class Filesystem {
  private readonly rpc: PromiseClient<typeof FilesystemService>

  private readonly defaultWatchTimeout = 60_000 // 60 seconds

  constructor(
    transport: Transport,
    private readonly envdApi: EnvdApiClient,
    private readonly connectionConfig: ConnectionConfig
  ) {
    this.rpc = createPromiseClient(FilesystemService, transport)
  }

  async read(path: string, opts?: FilesystemRequestOpts & { format?: 'text' }): Promise<string>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'bytes' }): Promise<Uint8Array>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'blob' }): Promise<Blob>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'stream' }): Promise<ReadableStream<Uint8Array>>
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format?: 'text' | 'stream' | 'bytes' | 'blob' }
  ): Promise<unknown> {
    const format = opts?.format ?? 'text'

    const res = await this.envdApi.api.GET('/files', {
      params: {
        query: {
          path,
          username: opts?.user || defaultUsername,
        },
      },
      parseAs: format === 'bytes' ? 'arrayBuffer' : format,
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
    })

    const err = await handleEnvdApiError(res)
    if (err) {
      throw err
    }

    if (format === 'bytes') {
      return new Uint8Array(res.data as ArrayBuffer)
    }

    return res.data
  }

  async write(path: string, data: WriteData, opts?: FilesystemRequestOpts): Promise<EntryInfo>
  async write(files: { path: string; data: WriteData }[], opts?: FilesystemRequestOpts): Promise<EntryInfo[]>
  async write(
    pathOrFiles: string | { path: string; data: WriteData }[],
    dataOrOpts?: WriteData | FilesystemRequestOpts,
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo | EntryInfo[]> {
    if (typeof pathOrFiles === 'string' && Array.isArray(dataOrOpts)) {
      throw new Error('Cannot specify path with array of files')
    }

    const { path, writeOpts, writeFiles } =
      typeof pathOrFiles === 'string'
        ? { path: pathOrFiles, writeOpts: opts, writeFiles: [{ data: dataOrOpts }] }
        : { path: undefined, writeOpts: dataOrOpts, writeFiles: pathOrFiles }

    const blobs = await Promise.all(
      (writeFiles as { path: string; data: WriteData }[]).map((f) => new Response(f.data).blob())
    )

    const res = await this.envdApi.api.POST('/files', {
      params: {
        query: {
          path,
          username: (writeOpts as FilesystemRequestOpts)?.user || defaultUsername,
        },
      },
      bodySerializer() {
        return blobs.reduce((fd, blob, i) => {
          // Important: RFC 7578, Section 4.2 requires that if a filename is provided,
          // the directory path information must not be used.
          fd.append('file', blob, writeFiles[i].path)

          return fd
        }, new FormData())
      },
      body: {},
      signal: this.connectionConfig.getSignal((writeOpts as FilesystemRequestOpts)?.requestTimeoutMs),
    })

    const err = await handleEnvdApiError(res)
    if (err) {
      throw err
    }

    const files = res.data
    if (!files || files.length === 0) {
      throw new Error('Expected to receive information about written file')
    }

    return files.length === 1 && path ? (files[0] as EntryInfo) : (files as EntryInfo[])
  }

  async list(path: string, opts?: FilesystemRequestOpts): Promise<EntryInfo[]> {
    try {
      const res = await this.rpc.listDir(
        { path },
        {
          headers: authenticationHeader(opts?.user),
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

      const entries: EntryInfo[] = []

      for (const e of res.entries) {
        const type = mapFileType(e.type)

        if (type) {
          entries.push({
            name: e.name,
            type,
            path: e.path,
          })
        }
      }

      return entries
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async makeDir(path: string, opts?: FilesystemRequestOpts): Promise<boolean> {
    try {
      await this.rpc.makeDir(
        { path },
        {
          headers: authenticationHeader(opts?.user),
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === Code.AlreadyExists) {
          return false
        }
      }

      throw handleRpcError(err)
    }
  }

  async rename(oldPath: string, newPath: string, opts?: FilesystemRequestOpts): Promise<EntryInfo> {
    try {
      const res = await this.rpc.move(
        {
          source: oldPath,
          destination: newPath,
        },
        {
          headers: authenticationHeader(opts?.user),
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

      const entry = res.entry
      if (!entry) {
        throw new Error('Expected to receive information about moved object')
      }

      return {
        name: entry.name,
        type: mapFileType(entry.type),
        path: entry.path,
      }
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async remove(path: string, opts?: FilesystemRequestOpts): Promise<void> {
    try {
      await this.rpc.remove(
        { path },
        {
          headers: authenticationHeader(opts?.user),
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async exists(path: string, opts?: FilesystemRequestOpts): Promise<boolean> {
    try {
      await this.rpc.stat(
        { path },
        {
          headers: authenticationHeader(opts?.user),
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === Code.NotFound) {
          return false
        }
      }

      throw handleRpcError(err)
    }
  }

  async watch(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: FilesystemRequestOpts & { timeout?: number; onExit?: (err?: Error) => void | Promise<void> }
  ): Promise<WatchHandle> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
          controller.abort()
        }, requestTimeoutMs)
      : undefined

    const events = this.rpc.watchDir(
      { path },
      {
        headers: {
          ...authenticationHeader(opts?.user),
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        signal: controller.signal,
        timeoutMs: opts?.timeout ?? this.defaultWatchTimeout,
      }
    )

    try {
      await handleWatchDirStartEvent(events)

      clearTimeout(reqTimeout)

      return new WatchHandle(() => controller.abort(), events, onEvent, opts?.onExit)
    } catch (err) {
      throw handleRpcError(err)
    }
  }
}
