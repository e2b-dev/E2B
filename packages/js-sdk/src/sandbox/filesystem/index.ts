import {
  createPromiseClient,
  Transport,
  PromiseClient,
  ConnectError,
  Code,
} from '@connectrpc/connect'
import {
  ConnectionConfig,
  defaultUsername,
  Username,
  ConnectionOpts,
  KEEPALIVE_PING_INTERVAL_SEC,
  KEEPALIVE_PING_HEADER,
} from '../../connectionConfig'

import { handleEnvdApiError, handleWatchDirStartEvent } from '../../envd/api'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'

import { EnvdApiClient } from '../../envd/api'
import { Filesystem as FilesystemService } from '../../envd/filesystem/filesystem_connect'
import { FileType as FsFileType } from '../../envd/filesystem/filesystem_pb'

import { WatchHandle, FilesystemEvent } from './watchHandle'

/**
 * Information about a filesystem object.
 */
export interface EntryInfo {
  name: string
  type?: FileType
  path: string
}

/**
 * Type of filesystem object.
 */
export const enum FileType {
  FILE = 'file',
  DIR = 'dir',
}

function mapFileType(fileType: FsFileType) {
  switch (fileType) {
    case FsFileType.DIRECTORY:
      return FileType.DIR
    case FsFileType.FILE:
      return FileType.FILE
  }
}

/**
 * Options for sending a request to the filesystem.
 */
export interface FilesystemRequestOpts
  extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {
  user?: Username
}

/**
 * Options for watching a directory.
 */
export interface WatchOpts extends FilesystemRequestOpts {
  timeout?: number
  onExit?: (err: Error) => void
}

/**
 * Manager for interacting with the filesystem in the sandbox.
 */
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

  /**
   * Reads a whole file content and returns it in requested format (text by default).
   *
   * @param path Path to the file
   * @param opts Options for the request
   * @param {format} [opts.format] Format of the file content. Default is 'text'.
   * @returns File content in requested format
   */
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format?: 'text' }
  ): Promise<string>
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format: 'bytes' }
  ): Promise<Uint8Array>
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format: 'blob' }
  ): Promise<Blob>
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format: 'stream' }
  ): Promise<ReadableStream<Uint8Array>>
  async read(
    path: string,
    opts?: FilesystemRequestOpts & {
      format?: 'text' | 'stream' | 'bytes' | 'blob'
    }
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

    // When the file is empty, res.data is parsed as `{}`. This is a workaround to return an empty string.
    if (res.response.headers.get('content-length') === '0') {
      return ''
    }

    return res.data
  }

  /**
   * Writes content to a file on the path.
   *   When writing to a file that doesn't exist, the file will get created.
   *   When writing to a file that already exists, the file will get overwritten.
   *   When writing to a file that's in a directory that doesn't exist, the directory will get created.
   *
   * @param path Path to a new file. For example '/dirA/dirB/newFile.txt' when creating 'newFile.txt'
   * @param data Data to write to a new file
   * @param opts Options for the request
   * @returns Information about the written file
   */
  async write(
    path: string,
    data: string | ArrayBuffer | Blob | ReadableStream,
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo> {
    const blob = await new Response(data).blob()

    const res = await this.envdApi.api.POST('/files', {
      params: {
        query: {
          path,
          username: opts?.user || defaultUsername,
        },
      },
      bodySerializer() {
        const fd = new FormData()

        fd.append('file', blob)

        return fd
      },
      body: {},
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
    })

    const err = await handleEnvdApiError(res)
    if (err) {
      throw err
    }

    const files = res.data
    if (!files || files.length === 0) {
      throw new Error('Expected to receive information about written file')
    }

    return files[0] as EntryInfo
  }

  /**
   * Lists entries in a directory.
   *
   * @param path Path to the directory
   * @param opts Options for the request
   * @returns List of entries in the directory
   */
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

  /**
   * Creates a new directory and all directories along the way if needed on the specified pth.
   *
   * @param path Path to a new directory. For example '/dirA/dirB' when creating 'dirB'.
   * @param opts Options for the request
   * @returns True if the directory was created, false if it already exists
   */
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

  /**
   * Renames a file or directory from one path to another.
   *
   * @param oldPath Path to the file or directory to move
   * @param newPath Path to move the file or directory to
   * @param opts Options for the request
   * @returns Information about the moved object
   */
  async rename(
    oldPath: string,
    newPath: string,
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo> {
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

  /**
   * Removes a file or a directory.
   * @param path Path to a file or a directory
   * @param opts Options for the request
   */
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

  /**
   * Checks if a file or a directory exists.
   *
   * @param path Path to a file or a directory
   * @param opts Options for the request
   * @returns True if the file or directory exists, false otherwise
   */
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

  /**
   * Watches directory for filesystem events.
   *
   * @param path Path to a directory that will be watched
   * @param onEvent Callback that will be called when an event in the directory occurs
   * @param opts Options for the request
   * @returns New watcher
   */
  async watchDir(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: FilesystemRequestOpts & {
      timeout?: number
      onExit?: (err?: Error) => void | Promise<void>
    }
  ): Promise<WatchHandle> {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

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

      return new WatchHandle(
        () => controller.abort(),
        events,
        onEvent,
        opts?.onExit
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }
}
