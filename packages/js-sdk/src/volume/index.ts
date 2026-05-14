import { ApiClient, handleApiError, components as ApiComponents } from '../api'
import {
  VolumeApiClient,
  VolumeApiComponents,
  VolumeConnectionConfig,
  VolumeApiOpts,
  FILE_TIMEOUT_MS,
} from './client'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { NotFoundError, VolumeError } from '../errors'
import { toBlob } from '../utils'
import { VolumeFileType } from './types'
import type {
  VolumeAndToken,
  VolumeEntryStat,
  VolumeInfo,
  VolumeMetadataOptions,
  VolumeWriteOptions,
} from './types'

/**
 * Convert API VolumeEntryStat to SDK VolumeEntryStat.
 */
function convertVolumeEntryStat(
  entry: VolumeApiComponents['schemas']['VolumeEntryStat']
): VolumeEntryStat {
  return {
    ...entry,
    type: entry.type as VolumeFileType,
    atime: new Date(entry.atime),
    mtime: new Date(entry.mtime),
    ctime: new Date(entry.ctime),
  }
}

/**
 * Module for interacting with E2B volumes.
 *
 * Create a `Volume` instance to interact with a volume by its ID,
 * or use the static methods to manage volumes.
 */
export class Volume {
  /**
   * Volume ID.
   */
  readonly volumeId: string

  /**
   * Volume name.
   */
  readonly name: string

  /**
   * Volume auth token.
   */
  readonly token: string

  /**
   * Domain used for constructing the volume API URL.
   */
  readonly domain?: string

  /**
   * Whether to use debug mode (connects to local volume API server).
   */
  readonly debug?: boolean

  /**
   * Create a local Volume instance with no API call.
   *
   * @param volumeId volume ID.
   * @param name volume name.
   * @param token volume auth token.
   * @param domain domain for the volume API.
   * @param debug whether to use debug mode.
   */
  constructor(
    volumeId: string,
    name: string,
    token: string,
    domain?: string,
    debug?: boolean
  ) {
    this.volumeId = volumeId
    this.name = name
    this.token = token
    this.domain = domain
    this.debug = debug
  }

  /**
   * Create a new volume.
   *
   * @param name name of the volume.
   * @param opts connection options.
   *
   * @returns new Volume instance.
   */
  static async create(name: string, opts?: ConnectionOpts): Promise<Volume> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/volumes', {
      body: {
        name,
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return new Volume(
      res.data.volumeID,
      res.data.name,
      res.data.token,
      config.domain,
      config.debug
    )
  }

  /**
   * Connect to an existing volume by ID.
   *
   * @param volumeId volume ID.
   * @param opts connection options.
   *
   * @returns Volume instance.
   */
  static async connect(
    volumeId: string,
    opts?: ConnectionOpts
  ): Promise<Volume> {
    const config = new ConnectionConfig(opts)
    const { name, token } = await Volume.getInfo(volumeId, opts)
    return new Volume(volumeId, name, token, config.domain, config.debug)
  }

  /**
   * Get volume information.
   *
   * @param volumeId volume ID.
   * @param opts connection options.
   *
   * @returns volume information.
   */
  static async getInfo(
    volumeId: string,
    opts?: ConnectionOpts
  ): Promise<VolumeAndToken> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes/{volumeID}', {
      params: {
        path: {
          volumeID: volumeId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Volume ${volumeId} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return {
      volumeId: res.data!.volumeID,
      name: res.data!.name,
      token: res.data!.token,
    }
  }

  /**
   * List all volumes.
   *
   * @param opts connection options.
   *
   * @returns list of volume information.
   */
  static async list(opts?: ConnectionOpts): Promise<VolumeInfo[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes', {
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return (res.data ?? []).map((vol: ApiComponents['schemas']['Volume']) => ({
      volumeId: vol.volumeID,
      name: vol.name,
    }))
  }

  /**
   * Destroy a volume.
   *
   * @param volumeId volume ID.
   * @param opts connection options.
   */
  static async destroy(
    volumeId: string,
    opts?: ConnectionOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/volumes/{volumeID}', {
      params: {
        path: {
          volumeID: volumeId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      return false
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return true
  }

  /**
   * List directory contents.
   *
   * @param path path to the directory.
   * @param opts connection options.
   * @param [opts.depth] number of layers deep to recurse into the directory (default: 1).
   *
   * @returns list of entries in the directory.
   */
  async list(
    path: string,
    opts?: VolumeApiOpts & { depth?: number }
  ): Promise<VolumeEntryStat[]> {
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const res = await client.api.GET('/volumecontent/{volumeID}/dir', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          depth: opts?.depth,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    // VolumeDirectoryListing is an array according to the spec
    const entries = Array.isArray(res.data) ? res.data : []
    return entries.map(convertVolumeEntryStat)
  }

  /**
   * Create a directory.
   *
   * @param path path to the directory to create.
   * @param options directory creation options.
   * @param opts connection options.
   */
  async makeDir(
    path: string,
    opts?: VolumeWriteOptions & VolumeApiOpts
  ): Promise<VolumeEntryStat> {
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const res = await client.api.POST('/volumecontent/{volumeID}/dir', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          uid: opts?.uid,
          gid: opts?.gid,
          mode: opts?.mode,
          force: opts?.force,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertVolumeEntryStat(
      res.data as VolumeApiComponents['schemas']['VolumeEntryStat']
    )
  }

  /**
   * Get information about a file or directory.
   *
   * @param path path to the file or directory.
   * @param opts connection options.
   *
   * @returns information about the entry.
   */
  async getInfo(path: string, opts?: VolumeApiOpts): Promise<VolumeEntryStat> {
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const res = await client.api.GET('/volumecontent/{volumeID}/path', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertVolumeEntryStat(
      res.data as VolumeApiComponents['schemas']['VolumeEntryStat']
    )
  }

  /**
   * Check whether a file or directory exists.
   *
   * Uses {@link getInfo} under the hood. Returns `true` if the path exists,
   * `false` if it does not (404). Other errors are rethrown.
   *
   * @param path path to the file or directory.
   * @param opts connection options.
   *
   * @returns `true` if the path exists, `false` otherwise.
   */
  async exists(path: string, opts?: VolumeApiOpts): Promise<boolean> {
    try {
      await this.getInfo(path, opts)
      return true
    } catch (err) {
      if (err instanceof NotFoundError) {
        return false
      }
      throw err
    }
  }

  /**
   * Update file or directory metadata.
   *
   * @param path path to the file or directory.
   * @param metadata metadata to update (uid, gid, mode).
   * @param opts connection options.
   *
   * @returns updated entry information.
   */
  async updateMetadata(
    path: string,
    metadata: VolumeMetadataOptions,
    opts?: VolumeApiOpts
  ): Promise<VolumeEntryStat> {
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const res = await client.api.PATCH('/volumecontent/{volumeID}/path', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
        },
      },
      body: {
        uid: metadata.uid,
        gid: metadata.gid,
        mode: metadata.mode,
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertVolumeEntryStat(
      res.data as VolumeApiComponents['schemas']['VolumeEntryStat']
    )
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
  async readFile(
    path: string,
    opts?: VolumeApiOpts & { format?: 'text' }
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
  async readFile(
    path: string,
    opts?: VolumeApiOpts & { format: 'bytes' }
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
  async readFile(
    path: string,
    opts?: VolumeApiOpts & { format: 'blob' }
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
  async readFile(
    path: string,
    opts?: VolumeApiOpts & { format: 'stream' }
  ): Promise<ReadableStream<Uint8Array>>
  async readFile(
    path: string,
    opts?: VolumeApiOpts & {
      format?: 'text' | 'stream' | 'bytes' | 'blob'
    }
  ): Promise<unknown> {
    const format = opts?.format ?? 'text'
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const res = await client.api.GET('/volumecontent/{volumeID}/file', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
        },
      },
      parseAs: format === 'bytes' ? 'arrayBuffer' : format,
      signal: config.getSignal(
        opts?.requestTimeoutMs ?? FILE_TIMEOUT_MS,
        opts?.signal
      ),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    if (format === 'bytes') {
      return new Uint8Array(res.data as ArrayBuffer)
    }

    if (format === 'text') {
      // When the file is empty, res.data is parsed as `{}`. This is a workaround to return an empty string.
      if (res.response.headers.get('content-length') === '0') {
        return ''
      }
      return typeof res.data === 'string' ? res.data : ''
    }

    return res.data
  }

  /**
   * Write content to a file.
   *
   * Writing to a file that doesn't exist creates the file.
   *
   * Writing to a file that already exists overwrites the file.
   *
   * @param path path to the file.
   * @param data data to write to the file. Data can be a string, `ArrayBuffer`, `Blob`, or `ReadableStream`.
   * @param options file creation options.
   * @param opts connection options.
   *
   * @returns information about the written file
   */
  async writeFile(
    path: string,
    data: string | ArrayBuffer | Blob | ReadableStream<Uint8Array>,
    opts?: VolumeWriteOptions & VolumeApiOpts
  ): Promise<VolumeEntryStat> {
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const blob = await toBlob(data)

    const res = await client.api.PUT('/volumecontent/{volumeID}/file', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          uid: opts?.uid,
          gid: opts?.gid,
          mode: opts?.mode,
          force: opts?.force,
        },
      },
      bodySerializer: () => blob,
      body: {} as any,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      signal: config.getSignal(
        opts?.requestTimeoutMs ?? FILE_TIMEOUT_MS,
        opts?.signal
      ),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertVolumeEntryStat(
      res.data as VolumeApiComponents['schemas']['VolumeEntryStat']
    )
  }

  /**
   * Remove a file or directory.
   *
   * @param path path to the file or directory to remove.
   * @param opts connection options.
   */
  async remove(path: string, opts?: VolumeApiOpts): Promise<void> {
    const config = new VolumeConnectionConfig(this, opts)
    const client = new VolumeApiClient(config)

    const res = await client.api.DELETE('/volumecontent/{volumeID}/path', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }
  }
}

export type {
  VolumeInfo,
  VolumeAndToken,
  VolumeEntryStat,
  VolumeMetadataOptions,
  VolumeWriteOptions,
} from './types'

export type { VolumeApiOpts, VolumeConnectionConfig } from './client'
export { VolumeFileType } from './types'
