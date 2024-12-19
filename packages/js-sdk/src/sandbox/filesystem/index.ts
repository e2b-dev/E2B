import {
  createClient,
  Transport,
  Client,
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
import { FileType as FsFileType, Filesystem as FilesystemService } from '../../envd/filesystem/filesystem_pb'

import { WatchHandle, FilesystemEvent } from './watchHandle'

import { compareVersions } from 'compare-versions'
import { TemplateError } from '../../errors'

/**
 * Sandbox filesystem object information.
 */
export interface EntryInfo {
  /**
   * Name of the filesystem object.
   */
  name: string
  /**
   * Type of the filesystem object.
   */
  type?: FileType
  /**
   * Path to the filesystem object.
   */
  path: string
}

/**
 * Sandbox filesystem object type.
 */
export const enum FileType {
  /**
   * Filesystem object is a file.
   */
  FILE = 'file',
  /**
   * Filesystem object is a directory.
   */
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
 * Options for the sandbox filesystem operations.
 */
export interface FilesystemRequestOpts
  extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {
  /**
   * User to use for the operation in the sandbox.
   * This affects the resolution of relative paths and ownership of the created filesystem objects.
   */
  user?: Username
}

/**
 * Options for watching a directory.
 */
export interface WatchOpts extends FilesystemRequestOpts {
  /**
   * Timeout for the watch operation in **milliseconds**.
   * You can pass `0` to disable the timeout.
   *
   * @default 60_000 // 60 seconds
   */
  timeoutMs?: number
  /**
   * Callback to call when the watch operation stops.
   */
  onExit?: (err?: Error) => void | Promise<void>
  /**
   * Watch the directory recursively
   */
  recursive?: boolean
}

/**
 * Module for interacting with the sandbox filesystem.
 */
export class Filesystem {
  private readonly rpc: Client<typeof FilesystemService>

  private readonly defaultWatchTimeout = 60_000 // 60 seconds
  private readonly defaultWatchRecursive = false

  constructor(
    transport: Transport,
    private readonly envdApi: EnvdApiClient,
    private readonly connectionConfig: ConnectionConfig
  ) {
    this.rpc = createClient(FilesystemService, transport)
  }

  /**
   * Read file content as a `string`.
   *
   * You can pass `text`, `bytes`, `blob`, or `stream` to `opts.format` to change the return type.
   *
   * @param path path to the file.
   * @param opts connection options.
   * @param [opts.format] format of the file content—`text` by default.
   *
   * @returns file content as string
   */
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format?: 'text' }
  ): Promise<string>
  /**
   * Read file content as a `Uint8Array`.
   *
   * You can pass `text`, `bytes`, `blob`, or `stream` to `opts.format` to change the return type.
   *
   * @param path path to the file.
   * @param opts connection options.
   * @param [opts.format] format of the file content—`bytes`.
   *
   * @returns file content as `Uint8Array`
   */
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format: 'bytes' }
  ): Promise<Uint8Array>
  /**
   * Read file content as a `Blob`.
   *
   * You can pass `text`, `bytes`, `blob`, or `stream` to `opts.format` to change the return type.
   *
   * @param path path to the file.
   * @param opts connection options.
   * @param [opts.format] format of the file content—`blob`.
   *
   * @returns file content as `Blob`
   */
  async read(
    path: string,
    opts?: FilesystemRequestOpts & { format: 'blob' }
  ): Promise<Blob>
  /**
   * Read file content as a `ReadableStream`.
   *
   * You can pass `text`, `bytes`, `blob`, or `stream` to `opts.format` to change the return type.
   *
   * @param path path to the file.
   * @param opts connection options.
   * @param [opts.format] format of the file content—`stream`.
   *
   * @returns file content as `ReadableStream`
   */
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
   * Write content to a file.
   *
   *
   * Writing to a file that doesn't exist creates the file.
   *
   * Writing to a file that already exists overwrites the file.
   *
   * Writing to a file at path that doesn't exist creates the necessary directories.
   *
   * @param path path to file.
   * @param data data to write to the file. Data can be a string, `ArrayBuffer`, `Blob`, or `ReadableStream`.
   * @param opts connection options.
   *
   * @returns information about the written file
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
      headers: {
        'Content-Type': 'multipart/form-data',
        'Bun-Content-Type': 'temporary-fix', // https://github.com/oven-sh/bun/issues/14988
      },
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
   * List entries in a directory.
   *
   * @param path path to the directory.
   * @param opts connection options.
   *
   * @returns list of entries in the sandbox filesystem directory.
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
   * Create a new directory and all directories along the way if needed on the specified path.
   *
   * @param path path to a new directory. For example '/dirA/dirB' when creating 'dirB'.
   * @param opts connection options.
   *
   * @returns `true` if the directory was created, `false` if it already exists.
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
   * Rename a file or directory.
   *
   * @param oldPath path to the file or directory to rename.
   * @param newPath new path for the file or directory.
   * @param opts connection options.
   *
   * @returns information about renamed file or directory.
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
   * Remove a file or directory.
   *
   * @param path path to a file or directory.
   * @param opts connection options.
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
   * Check if a file or a directory exists.
   *
   * @param path path to a file or a directory
   * @param opts connection options.
   *
   * @returns `true` if the file or directory exists, `false` otherwise
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
   * Start watching a directory for filesystem events.
   *
   * @param path path to directory to watch.
   * @param onEvent callback to call when an event in the directory occurs.
   * @param opts connection options.
   *
   * @returns `WatchHandle` object for stopping watching directory.
   */
  async watchDir(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: WatchOpts
  ): Promise<WatchHandle> {
    if (opts?.recursive && this.envdApi.version && compareVersions(this.envdApi.version, '0.1.3') < 0) {
      throw new TemplateError(
        'You need to update the template to use recursive watching. ' +
        'You can do this by running `e2b template build` in the directory with the template.'
      )
    }

    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
        controller.abort()
      }, requestTimeoutMs)
      : undefined

    const events = this.rpc.watchDir(
      {
        path,
        recursive: opts?.recursive ?? this.defaultWatchRecursive,
      },
      {
        headers: {
          ...authenticationHeader(opts?.user),
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        signal: controller.signal,
        timeoutMs: opts?.timeoutMs ?? this.defaultWatchTimeout,
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
