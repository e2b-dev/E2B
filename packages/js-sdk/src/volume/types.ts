import type { components } from '../api/schema.gen'
import type { ConnectionOpts } from '../connectionConfig'

/**
 * Information about a volume.
 */
export type VolumeInfo = {
  /**
   * Volume ID.
   */
  volumeId: string

  /**
   * Volume name.
   */
  name: string
}

/**
 * File type enum.
 */
export type VolumeFileType = components['schemas']['VolumeEntryStat']['type']

/**
 * Volume entry stat with dates converted to Date objects.
 */
export type VolumeEntryStat = Omit<
  components['schemas']['VolumeEntryStat'],
  'atime' | 'mtime' | 'ctime'
> & {
  /**
   * Access time as a Date object.
   */
  atime: Date

  /**
   * Modification time as a Date object.
   */
  mtime: Date

  /**
   * Creation time as a Date object.
   */
  ctime: Date
}

/**
 * Options for updating file metadata.
 */
export type VolumeMetadataOptions = {
  /**
   * User ID of the file or directory.
   */
  uid?: number

  /**
   * Group ID of the file or directory.
   */
  gid?: number

  /**
   * Mode of the file or directory.
   */
  mode?: number
}

/**
 * Options for file and directory operations.
 */
export type VolumeWriteOptions = VolumeMetadataOptions & {
  /**
   * For makeDir: Create parent directories if they don't exist.
   * For writeFile: Force overwrite of an existing file.
   */
  force?: boolean
}

/**
 * Options for remove operation.
 */
export type VolumeRemoveOptions = {
  /**
   * Delete all files and directories recursively (for directories only).
   */
  recursive?: boolean
}

/**
 * Options for request to the Volume API.
 */
export type VolumeApiOpts = Partial<
  Pick<
    ConnectionOpts,
    'apiKey' | 'headers' | 'debug' | 'domain' | 'requestTimeoutMs'
  >
>
