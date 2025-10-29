import {
  Client,
  Code,
  ConnectError,
  createClient,
  Transport,
} from '@connectrpc/connect'
import {
  ConnectionConfig,
  ConnectionOpts,
  defaultUsername,
  KEEPALIVE_PING_HEADER,
  KEEPALIVE_PING_INTERVAL_SEC,
  Username,
} from '../../connectionConfig'

import { handleEnvdApiError, handleWatchDirStartEvent } from '../../envd/api'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'

import { EnvdApiClient } from '../../envd/api'
import {
  Filesystem as FilesystemService,
  FileType as FsFileType,
} from '../../envd/filesystem/filesystem_pb'

import { FilesystemEvent, WatchHandle } from './watchHandle'

import type { Timestamp } from '@bufbuild/protobuf/wkt'
import { compareVersions } from 'compare-versions'
import {
  ENVD_DEFAULT_USER,
  ENVD_VERSION_RECURSIVE_WATCH,
} from '../../envd/versions'
import { InvalidArgumentError, TemplateError } from '../../errors'

/**
 * Sandbox filesystem object information.
 */
export interface WriteInfo {
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

export interface EntryInfo extends WriteInfo {
  /**
   * Size of the filesystem object in bytes.
   */
  size: number

  /**
   * File mode and permission bits.
   */
  mode: number

  /**
   * String representation of file permissions (e.g. 'rwxr-xr-x').
   */
  permissions: string

  /**
   * Owner of the filesystem object.
   */
  owner: string

  /**
   * Group owner of the filesystem object.
   */
  group: string

  /**
   * Last modification time of the filesystem object.
   */
  modifiedTime?: Date

  /**
   * If the filesystem object is a symlink, this is the target of the symlink.
   */
  symlinkTarget?: string
}

/**
 * Sandbox filesystem object type.
 */
export enum FileType {
  /**
   * Filesystem object is a file.
   */
  FILE = 'file',
  /**
   * Filesystem object is a directory.
   */
  DIR = 'dir',
}

export type WriteEntry = {
  path: string
  data: string | ArrayBuffer | Blob | ReadableStream
}

function mapFileType(fileType: FsFileType) {
  switch (fileType) {
    case FsFileType.DIRECTORY:
      return FileType.DIR
    case FsFileType.FILE:
      return FileType.FILE
  }
}

function mapModifiedTime(modifiedTime: Timestamp | undefined) {
  if (!modifiedTime) return undefined

  return new Date(
    Number(modifiedTime.seconds) * 1000 +
      Math.floor(modifiedTime.nanos / 1_000_000)
  )
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

export interface FilesystemListOpts extends FilesystemRequestOpts {
  /**
   * Depth of the directory to list.
   */
  depth?: number
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

    let user = opts?.user
    if (
      user == undefined &&
      compareVersions(this.envdApi.version, ENVD_DEFAULT_USER) < 0
    ) {
      user = defaultUsername
    }

    const res = await this.envdApi.api.GET('/files', {
      params: {
        query: {
          path,
          username: user,
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
  ): Promise<WriteInfo>
  async write(
    files: WriteEntry[],
    opts?: FilesystemRequestOpts
  ): Promise<WriteInfo[]>
  async write(
    pathOrFiles: string | WriteEntry[],
    dataOrOpts?:
      | string
      | ArrayBuffer
      | Blob
      | ReadableStream
      | FilesystemRequestOpts,
    opts?: FilesystemRequestOpts
  ): Promise<WriteInfo | WriteInfo[]> {
    if (typeof pathOrFiles !== 'string' && !Array.isArray(pathOrFiles)) {
      throw new Error('Path or files are required')
    }

    if (typeof pathOrFiles === 'string' && Array.isArray(dataOrOpts)) {
      throw new Error(
        'Cannot specify both path and array of files. You have to specify either path and data for a single file or an array for multiple files.'
      )
    }

    const { path, writeOpts, writeFiles } =
      typeof pathOrFiles === 'string'
        ? {
            path: pathOrFiles,
            writeOpts: opts as FilesystemRequestOpts,
            writeFiles: [
              {
                data: dataOrOpts as
                  | string
                  | ArrayBuffer
                  | Blob
                  | ReadableStream,
              },
            ],
          }
        : {
            path: undefined,
            writeOpts: dataOrOpts as FilesystemRequestOpts,
            writeFiles: pathOrFiles as WriteEntry[],
          }

    if (writeFiles.length === 0) return [] as WriteInfo[]

    const blobs = await Promise.all(
      writeFiles.map((f) => new Response(f.data).blob())
    )

    let user = writeOpts?.user
    if (
      user == undefined &&
      compareVersions(this.envdApi.version, ENVD_DEFAULT_USER) < 0
    ) {
      user = defaultUsername
    }

    const res = await this.envdApi.api.POST('/files', {
      params: {
        query: {
          path,
          username: user,
        },
      },
      bodySerializer() {
        return blobs.reduce((fd, blob, i) => {
          // Important: RFC 7578, Section 4.2 requires that if a filename is provided,
          // the directory path information must not be used.
          // BUT in our case we need to use the directory path information with a custom
          // multipart part name getter in envd.
          fd.append('file', blob, writeFiles[i].path)

          return fd
        }, new FormData())
      },
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      body: {},
    })

    const err = await handleEnvdApiError(res)
    if (err) {
      throw err
    }

    const files = res.data as WriteInfo[]
    if (!files) {
      throw new Error('Expected to receive information about written file')
    }

    return files.length === 1 && path ? files[0] : files
  }

  /**
   * List entries in a directory.
   *
   * @param path path to the directory.
   * @param opts connection options.
   *
   * @returns list of entries in the sandbox filesystem directory.
   */
  async list(path: string, opts?: FilesystemListOpts): Promise<EntryInfo[]> {
    if (typeof opts?.depth === 'number' && opts.depth < 1) {
      throw new InvalidArgumentError('depth should be at least one')
    }

    try {
      const res = await this.rpc.listDir(
        {
          path,
          depth: opts?.depth ?? 1,
        },
        {
          headers: authenticationHeader(this.envdApi.version, opts?.user),
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
            size: Number(e.size),
            mode: e.mode,
            permissions: e.permissions,
            owner: e.owner,
            group: e.group,
            modifiedTime: mapModifiedTime(e.modifiedTime),
            symlinkTarget: e.symlinkTarget,
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
          headers: authenticationHeader(this.envdApi.version, opts?.user),
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
          headers: authenticationHeader(this.envdApi.version, opts?.user),
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
        size: Number(entry.size),
        mode: entry.mode,
        permissions: entry.permissions,
        owner: entry.owner,
        group: entry.group,
        modifiedTime: mapModifiedTime(entry.modifiedTime),
        symlinkTarget: entry.symlinkTarget,
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
          headers: authenticationHeader(this.envdApi.version, opts?.user),
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
          headers: authenticationHeader(this.envdApi.version, opts?.user),
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
   * Get information about a file or directory.
   *
   * @param path path to a file or directory.
   * @param opts connection options.
   *
   * @returns information about the file or directory like name, type, and path.
   */
  async getInfo(
    path: string,
    opts?: FilesystemRequestOpts
  ): Promise<EntryInfo> {
    try {
      const res = await this.rpc.stat(
        { path },
        {
          headers: authenticationHeader(this.envdApi.version, opts?.user),
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

      if (!res.entry) {
        throw new Error(
          'Expected to receive information about the file or directory'
        )
      }

      return {
        name: res.entry.name,
        type: mapFileType(res.entry.type),
        path: res.entry.path,
        size: Number(res.entry.size),
        mode: res.entry.mode,
        permissions: res.entry.permissions,
        owner: res.entry.owner,
        group: res.entry.group,
        modifiedTime: mapModifiedTime(res.entry.modifiedTime),
        symlinkTarget: res.entry.symlinkTarget,
      }
    } catch (err) {
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
    opts?: WatchOpts & {
      onExit?: (err?: Error) => void | Promise<void>
    }
  ): Promise<WatchHandle> {
    if (
      opts?.recursive &&
      this.envdApi.version &&
      compareVersions(this.envdApi.version, ENVD_VERSION_RECURSIVE_WATCH) < 0
    ) {
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
          ...authenticationHeader(this.envdApi.version, opts?.user),
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
