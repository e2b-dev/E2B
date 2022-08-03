export const filesystemMethod = 'filesystem'

export interface FileInfo {
  isDir: boolean
  name: string
}

export interface FilesystemManager {
  readonly writeFile: (path: string, content: string) => Promise<void>
  readonly readFile: (path: string) => Promise<string>
  readonly removeFile: (path: string) => Promise<void>
  readonly listAllFiles: (path: string) => Promise<FileInfo[]>
}
