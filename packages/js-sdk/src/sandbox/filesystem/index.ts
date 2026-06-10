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
  setupRequestController,
  Username,
} from '../../connectionConfig'

import { handleEnvdApiError, handleWatchDirStartEvent } from '../../envd/api'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'

import { EnvdApiClient } from '../../envd/api'
import {
  EntryInfo as FsEntryInfo,
  Filesystem as FilesystemService,
  FileType as FsFileType,
} from '../../envd/filesystem/filesystem_pb'

import { FilesystemEvent, WatchHandle } from './watchHandle'

import type { Timestamp } from '@bufbuild/protobuf/wkt'
import { compareVersions } from 'compare-versions'
import {
  ENVD_DEFAULT_USER,
  ENVD_FILE_METADATA,
  ENVD_OCTET_STREAM_UPLOAD,
  ENVD_VERSION_FS_EVENT_ENTRY_INFO,
  ENVD_VERSION_RECURSIVE_WATCH,
} from '../../envd/versions'
import {
  FileNotFoundError,
  InvalidArgumentError,
  TemplateError,
} from '../../errors'
import { toBlob, toUploadBody } from '../../utils'

const FILESYSTEM_HTTP_ERROR_MAP: Record<number, (message: string) => Error> = {
  404: (message: string) => new FileNotFoundError(message),
}

const FILESYSTEM_RPC_ERROR_MAP: Partial<
  Record<Code, (message: string) => Error>
> = {
  [Code.NotFound]: (message: string) => new FileNotFoundError(message),
}

function handleFilesystemRpcError(err: unknown): Error {
  return handleRpcError(err, FILESYSTEM_RPC_ERROR_MAP)
}

function handleFilesystemEnvdApiError(res: {
  error?: { message?: string } | string
  response: Response
}) {
  return handleEnvdApiError(res, FILESYSTEM_HTTP_ERROR_MAP)
}

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
  /**
   * User-defined metadata stored on the file as `user.e2b.*` extended
   * attributes. On writes this reflects the metadata supplied on upload; on
   * reads (`getInfo`, `list`, `rename`) it reflects any `user.e2b.*` xattr on
   * the file, including ones set out-of-band. `undefined` when none is set.
   */
  metadata?: Record<string, string>
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

function mapMetadata(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata) return undefined
  return Object.keys(metadata).length === 0 ? undefined : metadata
}

const METADATA_HEADER_PREFIX = 'X-Metadata-'

// Metadata keys travel as `X-Metadata-<key>` HTTP header names, so they must be
// valid header tokens (RFC 7230); values travel as header values, restricted to
// printable US-ASCII.
const METADATA_KEY_REGEX = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/
const METADATA_VALUE_REGEX = /^[\x20-\x7e]*$/

function validateMetadata(metadata: Record<string, string> | undefined): void {
  if (!metadata) return
  for (const [key, value] of Object.entries(metadata)) {
    if (!METADATA_KEY_REGEX.test(key)) {
      throw new InvalidArgumentError(
        `Invalid metadata key ${JSON.stringify(
          key
        )}: keys must be non-empty and use only HTTP token characters (letters, digits and !#$%&'*+-.^_\`|~).`
      )
    }
    if (!METADATA_VALUE_REGEX.test(value)) {
      throw new InvalidArgumentError(
        `Invalid metadata value for key ${JSON.stringify(
          key
        )}: values must be printable US-ASCII.`
      )
    }
  }
}

function metadataHeaders(
  metadata: Record<string, string> | undefined
): Record<string, string> {
  if (!metadata) return {}
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    headers[`${METADATA_HEADER_PREFIX}${key}`] = value
  }
  return headers
}

/**
 * Map a protobuf `EntryInfo` to the SDK `EntryInfo`.
 */
export function mapEntryInfo(entry: FsEntryInfo): EntryInfo {
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
    metadata: mapMetadata(entry.metadata),
  }
}

/**
 * Options for the sandbox filesystem operations.
 */
export interface FilesystemRequestOpts
  extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs' | 'signal'>> {
  /**
   * User to use for the operation in the sandbox.
   * This affects the resolution of relative paths and ownership of the created filesystem objects.
   */
  user?: Username
}

/**
 * Options for writing files to the sandbox filesystem.
 */
export interface FilesystemWriteOpts extends FilesystemRequestOpts {
  /**
   * When true, the upload will be gzip-compressed.
   */
  gzip?: boolean
  /**
   * When true, the upload uses `application/octet-stream` instead of `multipart/form-data`.
   *
   * Defaults to `false`. Requires envd 0.5.7 or later — when not supported by
   * the sandbox's envd version, the upload falls back to `multipart/form-data`.
   */
  useOctetStream?: boolean
  /**
   * User-defined metadata to persist on the uploaded file(s) as extended
   * attributes. Keys are lowercased by the sandbox, so they may differ in case
   * when read back. Invalid keys or values throw an `InvalidArgumentError`.
   * The same metadata is applied to every file in a multi-file upload.
   * Requires envd 0.6.2 or later.
   */
  metadata?: Record<string, string>
}

/**
 * Options for reading files from the sandbox filesystem.
 */
export interface FilesystemReadOpts extends FilesystemRequestOpts {
  /**
   * When true, the download will request gzip-encoded responses.
   */
  gzip?: boolean
  /**
   * First byte to read (inclusive, zero-based). When set without `end`,
   * the read continues to the end of the file.
   *
   * Sent as an HTTP `Range` header — ranges operate on bytes, so when reading
   * with `format: 'text'` a range that splits a multi-byte UTF-8 codepoint
   * will produce a malformed string. Read as `bytes` and decode yourself if
   * you need precise text slicing.
   */
  start?: number
  /**
   * Last byte to read (inclusive, zero-based, matching HTTP `Range` semantics
   * — `start: 0, end: 9` returns 10 bytes). When set without `start`, the
   * read starts at byte 0.
   */
  end?: number
}

function buildRangeHeader(
  start: number | undefined,
  end: number | undefined
): string | undefined {
  if (start === undefined && end === undefined) return undefined

  if (start !== undefined && (!Number.isInteger(start) || start < 0)) {
    throw new InvalidArgumentError('start must be a non-negative integer')
  }
  if (end !== undefined && (!Number.isInteger(end) || end < 0)) {
    throw new InvalidArgumentError('end must be a non-negative integer')
  }
  if (start !== undefined && end !== undefined && start > end) {
    throw new InvalidArgumentError('start must be less than or equal to end')
  }

  return `bytes=${start ?? 0}-${end ?? ''}`
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
  /**
   * Include the {@link EntryInfo} of the affected entry in each {@link FilesystemEvent}.
   *
   * The entry is populated best-effort and may be `undefined` for events where the
   * entry no longer exists at the path (e.g. remove or rename-away events).
   *
   * Requires envd 0.6.3 or later. Watching with this option against an older sandbox
   * throws a `TemplateError`.
   */
  includeEntry?: boolean
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
    opts?: FilesystemReadOpts & { format?: 'text' }
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
    opts?: FilesystemReadOpts & { format: 'bytes' }
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
    opts?: FilesystemReadOpts & { format: 'blob' }
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
    opts?: FilesystemReadOpts & { format: 'stream' }
  ): Promise<ReadableStream<Uint8Array>>
  async read(
    path: string,
    opts?: FilesystemReadOpts & {
      format?: 'text' | 'bytes' | 'blob' | 'stream'
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

    const headers: Record<string, string> = {}
    if (opts?.gzip) {
      headers['Accept-Encoding'] = 'gzip'
    }

    const range = buildRangeHeader(opts?.start, opts?.end)
    if (range) {
      headers['Range'] = range
    }

    const res = await this.envdApi.api.GET('/files', {
      params: {
        query: {
          path,
          username: user,
        },
      },
      parseAs: format === 'bytes' ? 'arrayBuffer' : format,
      signal: this.connectionConfig.getSignal(
        opts?.requestTimeoutMs,
        opts?.signal
      ),
      headers,
    })

    const err = await handleFilesystemEnvdApiError(res)
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
    opts?: FilesystemWriteOpts
  ): Promise<WriteInfo>
  async write(
    files: WriteEntry[],
    opts?: FilesystemWriteOpts
  ): Promise<WriteInfo[]>
  async write(
    pathOrFiles: string | WriteEntry[],
    dataOrOpts?:
      | string
      | ArrayBuffer
      | Blob
      | ReadableStream
      | FilesystemWriteOpts,
    opts?: FilesystemWriteOpts
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
            writeOpts: opts as FilesystemWriteOpts,
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
            writeOpts: dataOrOpts as FilesystemWriteOpts,
            writeFiles: pathOrFiles as WriteEntry[],
          }

    if (writeFiles.length === 0) return [] as WriteInfo[]

    let user = writeOpts?.user
    if (
      user == undefined &&
      compareVersions(this.envdApi.version, ENVD_DEFAULT_USER) < 0
    ) {
      user = defaultUsername
    }

    const supportsOctetStream =
      compareVersions(this.envdApi.version, ENVD_OCTET_STREAM_UPLOAD) >= 0
    const useOctetStream =
      (writeOpts?.useOctetStream ?? false) && supportsOctetStream

    const metadata = writeOpts?.metadata
    validateMetadata(metadata)
    if (
      metadata &&
      Object.keys(metadata).length > 0 &&
      compareVersions(this.envdApi.version, ENVD_FILE_METADATA) < 0
    ) {
      throw new TemplateError('File metadata requires envd 0.6.2 or later.')
    }
    // Metadata is sent as request-scoped `X-Metadata-*` headers, so the same
    // metadata is applied to every file in a multi-file upload.
    const extraHeaders = metadataHeaders(metadata)

    const results: WriteInfo[] = []

    const useGzip = writeOpts?.gzip === true

    if (useOctetStream) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        ...extraHeaders,
      }
      if (useGzip) {
        headers['Content-Encoding'] = 'gzip'
      }

      const uploadResults = await Promise.all(
        writeFiles.map(async (file) => {
          const filePath = path ?? (file as WriteEntry).path
          const body = await toUploadBody(file.data, useGzip)

          const res = await this.envdApi.api.POST('/files', {
            params: {
              query: {
                path: filePath,
                username: user,
              },
            },
            bodySerializer: () => body,
            headers,
            signal: this.connectionConfig.getSignal(
              writeOpts?.requestTimeoutMs,
              writeOpts?.signal
            ),
            body: {},
          })

          const err = await handleFilesystemEnvdApiError(res)
          if (err) {
            throw err
          }

          const files = res.data as WriteInfo[]
          if (!files || files.length === 0) {
            throw new Error(
              'Expected to receive information about written file'
            )
          }

          for (const f of files) {
            f.metadata = mapMetadata(f.metadata)
          }

          return files
        })
      )

      for (const files of uploadResults) {
        results.push(...files)
      }
    } else {
      const formData = new FormData()
      for (const file of writeFiles) {
        formData.append(
          'file',
          await toBlob(file.data),
          (file as WriteEntry).path ?? path!
        )
      }

      const res = await this.envdApi.api.POST('/files', {
        params: {
          query: {
            path,
            username: user,
          },
        },
        bodySerializer: () => formData,
        headers: extraHeaders,
        signal: this.connectionConfig.getSignal(
          writeOpts?.requestTimeoutMs,
          writeOpts?.signal
        ),
        body: {},
      })

      const err = await handleFilesystemEnvdApiError(res)
      if (err) {
        throw err
      }

      const files = res.data as WriteInfo[]
      if (!files || files.length === 0) {
        throw new Error('Expected to receive information about written file')
      }

      for (const f of files) {
        f.metadata = mapMetadata(f.metadata)
      }

      results.push(...files)
    }

    return results.length === 1 && path ? results[0] : results
  }

  /**
   * Write multiple files.
   *
   *
   * Writing to a file that doesn't exist creates the file.
   *
   * Writing to a file that already exists overwrites the file.
   *
   * Writing to a file at path that doesn't exist creates the necessary directories.
   *
   * @param files list of files to write as `WriteEntry` objects, each containing `path` and `data`.
   * @param opts connection options.
   *
   * @returns information about the written files
   */
  async writeFiles(
    files: WriteEntry[],
    opts?: FilesystemWriteOpts
  ): Promise<WriteInfo[]> {
    return this.write(files, opts) as Promise<WriteInfo[]>
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )

      const entries: EntryInfo[] = []

      for (const e of res.entries) {
        // Skip entries with an unknown file type.
        if (!mapFileType(e.type)) {
          continue
        }

        entries.push(mapEntryInfo(e))
      }

      return entries
    } catch (err) {
      throw handleFilesystemRpcError(err)
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === Code.AlreadyExists) {
          return false
        }
      }

      throw handleFilesystemRpcError(err)
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )

      const entry = res.entry
      if (!entry) {
        throw new Error('Expected to receive information about moved object')
      }

      return mapEntryInfo(entry)
    } catch (err) {
      throw handleFilesystemRpcError(err)
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )
    } catch (err) {
      throw handleFilesystemRpcError(err)
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === Code.NotFound) {
          return false
        }
      }

      throw handleFilesystemRpcError(err)
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )

      if (!res.entry) {
        throw new Error(
          'Expected to receive information about the file or directory'
        )
      }

      return mapEntryInfo(res.entry)
    } catch (err) {
      throw handleFilesystemRpcError(err)
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
        'You need to update the template to use recursive watching.'
      )
    }

    if (
      opts?.includeEntry &&
      this.envdApi.version &&
      compareVersions(this.envdApi.version, ENVD_VERSION_FS_EVENT_ENTRY_INFO) <
        0
    ) {
      throw new TemplateError(
        'You need to update the template to include entry info in watch events.'
      )
    }

    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const { controller, clearStartTimeout, cleanup } = setupRequestController(
      requestTimeoutMs,
      opts?.signal
    )

    const events = this.rpc.watchDir(
      {
        path,
        recursive: opts?.recursive ?? this.defaultWatchRecursive,
        includeEntry: opts?.includeEntry ?? false,
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
      clearStartTimeout()

      return new WatchHandle(cleanup, events, onEvent, opts?.onExit)
    } catch (err) {
      cleanup()
      throw handleFilesystemRpcError(err)
    }
  }
}
