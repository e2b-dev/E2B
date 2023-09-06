import FilesystemWatcher from './filesystemWatcher'
import { CallOpts } from './sessionConnection'

export const filesystemService = 'filesystem'

export interface FileInfo {
  isDir: boolean
  name: string
}

export interface FilesystemManager {
  readonly write: (path: string, content: string, opts?: CallOpts) => Promise<void>
  // readonly writeBytes: (path: string, content: Uint8Array) => Promise<void>
  readonly read: (path: string, opts?: CallOpts) => Promise<string>
  // readonly readBytes: (path: string) => Promise<Uint8Array>
  readonly remove: (path: string, opts?: CallOpts) => Promise<void>
  readonly list: (path: string, opts?: CallOpts) => Promise<FileInfo[]>
  readonly makeDir: (path: string, opts?: CallOpts) => Promise<void>
  readonly watchDir: (path: string) => FilesystemWatcher
}
