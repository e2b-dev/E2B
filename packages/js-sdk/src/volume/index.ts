import { ApiClient, handleApiError } from '../api'
import { ConnectionConfig } from '../connectionConfig'
import { NotFoundError, VolumeError } from '../errors'
import { toBlob } from '../utils'
import type { components } from '../api/schema.gen'
import type {
  VolumeApiOpts,
  VolumeEntryStat,
  VolumeInfo,
  VolumeMetadataOptions,
  VolumeRemoveOptions,
  VolumeWriteOptions,
} from './types'

/**
 * Convert API VolumeEntryStat to SDK VolumeEntryStat.
 */
function convertVolumeEntryStat(
  entry: components['schemas']['VolumeEntryStat']
): VolumeEntryStat {
  return {
    ...entry,
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
   * Create a local Volume instance with no API call.
   *
   * @param volumeId volume ID.
   */
  constructor(volumeId: string, name?: string) {
    this.volumeId = volumeId
    this.name = name ?? volumeId
  }

  /**
   * Create a new volume.
   *
   * @param name name of the volume.
   * @param opts connection options.
   *
   * @returns new Volume instance.
   */
  static async create(name: string, opts?: VolumeApiOpts): Promise<Volume> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/volumes', {
      body: {
        name,
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return new Volume(res.data!.volumeID, res.data!.name)
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
    opts?: VolumeApiOpts
  ): Promise<Volume> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes/{volumeID}', {
      params: {
        path: {
          volumeID: volumeId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Volume ${volumeId} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return new Volume(res.data!.volumeID, res.data!.name)
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
    opts?: VolumeApiOpts
  ): Promise<VolumeInfo> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes/{volumeID}', {
      params: {
        path: {
          volumeID: volumeId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Volume ${volumeId} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return {
      volumeId: res.data!.volumeID,
      name: res.data!.name,
    }
  }

  /**
   * List all volumes.
   *
   * @param opts connection options.
   *
   * @returns list of volume information.
   */
  static async list(opts?: VolumeApiOpts): Promise<VolumeInfo[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes', {
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }

    return (res.data ?? []).map((vol: components['schemas']['Volume']) => ({
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
    opts?: VolumeApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/volumes/{volumeID}', {
      params: {
        path: {
          volumeID: volumeId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
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
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes/{volumeID}/dir', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          depth: opts?.depth,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
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
    options?: VolumeWriteOptions,
    opts?: VolumeApiOpts
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/volumes/{volumeID}/dir', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          uid: options?.uid,
          gid: options?.gid,
          mode: options?.mode,
          createParents: options?.force,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }
  }

  /**
   * Get information about a file or directory.
   *
   * @param path path to the file or directory.
   * @param opts connection options.
   *
   * @returns information about the entry.
   */
  async getEntryInfo(
    path: string,
    opts?: VolumeApiOpts
  ): Promise<VolumeEntryStat> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes/{volumeID}/stat', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
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
      res.data as components['schemas']['VolumeEntryStat']
    )
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
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.PATCH('/volumes/{volumeID}/file', {
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
      signal: config.getSignal(opts?.requestTimeoutMs),
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
      res.data as components['schemas']['VolumeEntryStat']
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
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/volumes/{volumeID}/file', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
        },
      },
      parseAs: format === 'bytes' ? 'arrayBuffer' : format,
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
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
    options?: VolumeWriteOptions,
    opts?: VolumeApiOpts
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    // Convert data to Blob using the same utility as sandbox.files.write
    const blob = await toBlob(data)

    // Convert Blob to ArrayBuffer for the API request
    // The API expects application/octet-stream
    const arrayBuffer = await blob.arrayBuffer()

    const res = await client.api.PUT('/volumes/{volumeID}/file', {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          uid: options?.uid,
          gid: options?.gid,
          mode: options?.mode,
          force: options?.force,
        },
      },
      body: arrayBuffer as unknown as string,
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Path ${path} not found`)
    }

    const err = handleApiError(res, VolumeError)
    if (err) {
      throw err
    }
  }

  /**
   * Remove a file or directory.
   *
   * @param path path to the file or directory to remove.
   * @param options removal options.
   * @param opts connection options.
   */
  async remove(
    path: string,
    options?: VolumeRemoveOptions,
    opts?: VolumeApiOpts
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    // Determine if it's a directory by checking entry info
    let isDirectory = false
    try {
      const entryInfo = await this.getEntryInfo(path, opts)
      isDirectory = entryInfo.type === 'directory'
    } catch (err) {
      // If we can't get entry info, assume it's a file and try the file endpoint
      // If that fails, the error will be thrown below
    }

    const endpoint = isDirectory
      ? '/volumes/{volumeID}/dir'
      : '/volumes/{volumeID}/file'
    const res = await client.api.DELETE(endpoint, {
      params: {
        path: {
          volumeID: this.volumeId,
        },
        query: {
          path,
          recursive: isDirectory ? options?.recursive : undefined,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
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
  VolumeFileType,
  VolumeWriteInfo,
  VolumeEntryStat,
  VolumeMetadataOptions,
  VolumeWriteOptions,
  VolumeRemoveOptions,
  VolumeApiOpts,
} from './types'
