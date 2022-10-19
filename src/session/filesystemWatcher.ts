import { filesystemService } from './filesystem'
import SessionConnection from "./sessionConnection"

export enum FilesystemOperation {
  Create = 'Create',
	Write = 'Write',
	Remove = 'Remove',
	Rename = 'Rename',
	Chmod = 'Chmod',
}

export interface FilesystemEvent {
  path: string
  operation: FilesystemOperation
  // Unix epoch in nanoseconds
  timestamp: number
  isDiretory: boolean
}

export type FilesystemEventListener = (event: FilesystemEvent) => void

class FilesystemWatcher {
  // Listeners to filesystem events.
  // Users of the this class can add their listeners to filesystem events
  // via `this.addEventListeners`
  private listeners: Set<FilesystemEventListener>
  private rpcSubscriptionID?: string

  constructor(
    private sessConn: SessionConnection,
    private path: string,
  ) {
    this.listeners = new Set<FilesystemEventListener>()
  }

  // Starts watching the path that was passed to the contructor
  async start() {
    // Already started.
    if (this.rpcSubscriptionID) return

    this.handleFilesystemEvents = this.handleFilesystemEvents.bind(this)

    this.rpcSubscriptionID = await this.sessConn.subscribe(
      filesystemService,
      this.handleFilesystemEvents,
      'watch',
      this.path,
    )
  }

  // Stops watching the path and removes all listeners.
  async stop() {
    if (this.rpcSubscriptionID) {
      await this.sessConn.unsubscribe(this.rpcSubscriptionID)
    }
    this.listeners.clear()
  }

  private handleFilesystemEvents(fsChange: FilesystemEvent) {
    this.listeners.forEach(l => {
      l(fsChange)
    })
  }

  addEventListener(l: FilesystemEventListener) {
    this.listeners.add(s)
    return {
      remove: () => {
        this.listeners.delete(s)
      }
    }
  }
}

export default FilesystemWatcher
