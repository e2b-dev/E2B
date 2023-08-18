import FilesystemWatcher from './filesystemWatcher'

export const filesystemService = 'filesystem'

export interface FileInfo {
  isDir: boolean
  name: string
}

export interface FilesystemManager {
  readonly write: (path: string, content: string) => Promise<void>
  // readonly writeBytes: (path: string, content: Uint8Array) => Promise<void>
  readonly read: (path: string) => Promise<string>
  // readonly readBytes: (path: string) => Promise<Uint8Array>
  readonly remove: (path: string) => Promise<void>
  readonly list: (path: string) => Promise<FileInfo[]>
  readonly makeDir: (path: string) => Promise<void>
  readonly watchDir: (path: string) => FilesystemWatcher
}
