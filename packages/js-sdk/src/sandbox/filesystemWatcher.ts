import { withTimeout } from '../utils/promise'
import { filesystemService } from './filesystem'
import { CallOpts, SandboxConnection } from './sandboxConnection'

export enum FilesystemOperation {
  Create = 'Create',
  Write = 'Write',
  Remove = 'Remove',
  Rename = 'Rename',
  Chmod = 'Chmod',
}

export interface FilesystemEvent {
  path: string;
  name: string;
  operation: FilesystemOperation;
  // Unix epoch in nanoseconds
  timestamp: number;
  isDir: boolean;
}

export type FilesystemEventListener = (event: FilesystemEvent) => Promise<void> | void;

class FilesystemWatcher {
  // Listeners to filesystem events.
  // Users of the this class can add their listeners to filesystem events
  // via `this.addEventListeners`
  private listeners: Set<FilesystemEventListener>
  private rpcSubscriptionID?: string

  constructor(
    private sessConn: SandboxConnection,
    private path: string,
  ) {
    this.listeners = new Set<FilesystemEventListener>()
  }

  // Starts watching the path that was passed to the contructor
  async start(opts?: CallOpts) {
    const start = async () => {
      // Already started.
      if (this.rpcSubscriptionID) return

      this.handleFilesystemEvents = this.handleFilesystemEvents.bind(this)

      this.rpcSubscriptionID = await this.sessConn._subscribe(
        filesystemService,
        this.handleFilesystemEvents,
        'watchDir',
        this.path,
      )
    }
    return await withTimeout(start, opts?.timeout)()
  }

  // Stops watching the path and removes all listeners.
  async stop() {
    this.listeners.clear()
    if (this.rpcSubscriptionID) {
      await this.sessConn._unsubscribe(this.rpcSubscriptionID)
    }
  }

  addEventListener(l: FilesystemEventListener) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  private handleFilesystemEvents(fsChange: FilesystemEvent) {
    this.listeners.forEach((l) => {
      l(fsChange)
    })
  }
}

export default FilesystemWatcher
