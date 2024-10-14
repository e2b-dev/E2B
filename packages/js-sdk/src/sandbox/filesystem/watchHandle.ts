import { handleRpcError } from '../../envd/rpc'
import {
  EventType,
  WatchDirResponse,
} from '../../envd/filesystem/filesystem_pb'

/**
 * Type of filesystem event.
 */
export const enum FilesystemEventType {
  CHMOD = 'chmod',
  CREATE = 'create',
  REMOVE = 'remove',
  RENAME = 'rename',
  WRITE = 'write',
}

function mapEventType(type: EventType) {
  switch (type) {
    case EventType.CHMOD:
      return FilesystemEventType.CHMOD
    case EventType.CREATE:
      return FilesystemEventType.CREATE
    case EventType.REMOVE:
      return FilesystemEventType.REMOVE
    case EventType.RENAME:
      return FilesystemEventType.RENAME
    case EventType.WRITE:
      return FilesystemEventType.WRITE
  }
}

/**
 * Information about a filesystem event.
 */
export interface FilesystemEvent {
  name: string
  type: FilesystemEventType
}

/**
 * Handle for watching a directory in the sandbox filesystem. It provides a method to close the watcher.
 */
export class WatchHandle {
  constructor(
    private readonly handleStop: () => void,
    private readonly events: AsyncIterable<WatchDirResponse>,
    private readonly onEvent?: (event: FilesystemEvent) => void | Promise<void>,
    private readonly onExit?: (err?: Error) => void | Promise<void>
  ) {
    this.handleEvents()
  }

  /**
   * Stop watching the directory.
   */
  async stop() {
    this.handleStop()
  }

  private async *iterateEvents() {
    try {
      for await (const event of this.events) {
        switch (event.event.case) {
          case 'filesystem':
            yield event.event
            break
        }
      }
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  private async handleEvents() {
    try {
      for await (const event of this.iterateEvents()) {
        const eventType = mapEventType(event.value.type)
        if (eventType === undefined) {
          continue
        }

        this.onEvent?.({
          name: event.value.name,
          type: eventType,
        })
      }
      this.onExit?.()
    } catch (err) {
      this.onExit?.(err as Error)
    }
  }
}
