import { VolumeApiComponents, VolumeApiOpts } from './client'

/**
 * File type enum.
 */
export enum VolumeFileType {
  UNKNOWN = 'unknown',
  FILE = 'file',
  DIRECTORY = 'directory',
  SYMLINK = 'symlink',
}

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
 * Information about a volume and its auth token.
 */
export type VolumeAndToken = VolumeInfo & {
  /**
   * Volume auth token.
   */
  token: string
}

/**
 * Volume entry stat with dates converted to Date objects.
 */
export type VolumeEntryStat = Omit<
  VolumeApiComponents['schemas']['VolumeEntryStat'],
  'atime' | 'mtime' | 'ctime' | 'type'
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

  /**
   * File type.
   */
  type: VolumeFileType
}

/**
 * Options for updating file metadata.
 */
export type VolumeMetadataOpts = {
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
 * Options for reading files from a volume.
 */
export type VolumeReadOpts = VolumeApiOpts & {
  /**
   * Idle timeout for a streamed read (`format: 'stream'`) in **milliseconds**:
   * abort if no chunk arrives from the server within this window *while
   * reading*. It bounds only the wire — a slow or paused consumer never trips
   * it (a consumer that holds the stream but stops reading is reclaimed
   * server-side). Defaults to the request timeout; pass `0` to disable.
   */
  streamIdleTimeoutMs?: number
}

/**
 * Options for file and directory operations.
 */
export type VolumeWriteOpts = VolumeMetadataOpts & {
  /**
   * For makeDir: Create parent directories if they don't exist.
   * For writeFile: Force overwrite of an existing file.
   */
  force?: boolean
}

/**
 * @deprecated Use {@link VolumeMetadataOpts} instead.
 */
export type VolumeMetadataOptions = VolumeMetadataOpts

/**
 * @deprecated Use {@link VolumeWriteOpts} instead.
 */
export type VolumeWriteOptions = VolumeWriteOpts
