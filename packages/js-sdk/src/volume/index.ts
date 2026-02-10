import { ApiClient, handleApiError } from '../api'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { NotFoundError } from '../errors'

/**
 * Information about a volume.
 */
export interface VolumeInfo {
  /**
   * Volume ID.
   */
  volumeId: string

  /**
   * Volume name.
   */
  name: string
}

export function Volume(volumeId: string): VolumeBase {
  return new VolumeBase(volumeId)
}

/**
 * Options for request to the Volume API.
 */
export interface VolumeApiOpts
  extends Partial<
    Pick<
      ConnectionOpts,
      'apiKey' | 'headers' | 'debug' | 'domain' | 'requestTimeoutMs'
    >
  > { }

/**
 * Module for interacting with E2B volumes.
 *
 * Create a `VolumeBase` instance to interact with a volume by its ID,
 * or use the static methods to manage volumes.
 */
export class VolumeBase {
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
   * @returns new VolumeBase instance.
   */
  static async create(name: string, opts?: VolumeApiOpts): Promise<VolumeBase> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/volumes', {
      body: {
        name,
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return new VolumeBase(res.data!.id, res.data!.name)
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

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return {
      volumeId: res.data!.id,
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

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return (res.data ?? []).map((vol) => ({
      volumeId: vol.id,
      name: vol.name,
    }))
  }

  /**
   * Destroy a volume.
   *
   * @param volumeId volume ID.
   * @param opts connection options.
   */
  static async destroy(volumeId: string, opts?: VolumeApiOpts): Promise<boolean> {
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

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return true
  }
}
