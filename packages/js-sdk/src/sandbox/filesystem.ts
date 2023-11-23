import FilesystemWatcher from './filesystemWatcher'
import { CallOpts } from './sandboxConnection'

export const filesystemService = 'filesystem'

export interface FileInfo {
  isDir: boolean;
  name: string
}

/**
 * Manager for interacting with the filesystem in the sandbox.
 */
export interface FilesystemManager {
  /**
   * Writes content to a new file on path.
   * @param path Path to a new file. For example '/dirA/dirB/newFile.txt' when creating 'newFile.txt'
   * @param content Content to write to a new file
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for call in milliseconds (default is 60 seconds)
   */
  write(path: string, content: string, opts?: CallOpts): Promise<void>;
  /**
   * Write array of bytes to a file.
   * This can be used when you cannot represent the data as an UTF-8 string.
   *
   * A new file will be created if it doesn't exist.
   * If the file already exists, it will be overwritten.
   * 
   * @param path path to a file
   * @param content byte array representing the content to write
   */
  writeBytes(path: string, content: Uint8Array): Promise<void>;
  /**
   * Reads the whole content of a file.
   * @param path Path to a file
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for call in milliseconds (default is 60 seconds)
   * @returns Content of a file
   */
  read(path: string, opts?: CallOpts): Promise<string>;
  /**
   * Reads the whole content of a file as an array of bytes.
   * @param path path to a file
   * @returns byte array representing the content of a file
   */
  readBytes(path: string): Promise<Uint8Array>;
  /**
   * Removes a file or a directory.
   * @param path Path to a file or a directory
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for call in milliseconds (default is 60 seconds)
   */
  remove(path: string, opts?: CallOpts): Promise<void>;
  /**
   * List files in a directory.
   * @param path Path to a directory
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for call in milliseconds (default is 60 seconds)
   * @returns Array of files in a directory
   */
  list(path: string, opts?: CallOpts): Promise<FileInfo[]>;
  /**
   * Creates a new directory and all directories along the way if needed on the specified pth.
   * @param path Path to a new directory. For example '/dirA/dirB' when creating 'dirB'.
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for call in milliseconds (default is 60 seconds)
   */
  makeDir(path: string, opts?: CallOpts): Promise<void>;
  /**
   * Watches directory for filesystem events.
   * @param path Path to a directory that will be watched
   * @returns New watcher
   */
  watchDir(path: string): FilesystemWatcher;
}
