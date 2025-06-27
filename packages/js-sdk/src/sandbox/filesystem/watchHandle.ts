import { handleRpcError } from '../../envd/rpc'
import {
  EventType,
  WatchDirResponse,
} from '../../envd/filesystem/filesystem_pb'

/**
 * Sandbox filesystem event types.
 */
export enum FilesystemEventType {
  /**
   * Filesystem object permissions were changed.
   */
  CHMOD = 'chmod',
  /**
   * Filesystem object was created.
   */
  CREATE = 'create',
  /**
   * Filesystem object was removed.
   */
  REMOVE = 'remove',
  /**
   * Filesystem object was renamed.
   */
  RENAME = 'rename',
  /**
   * Filesystem object was written to.
   */
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
  /**
   * Relative path to the filesystem object.
   */
  name: string
  /**
   * Filesystem operation event type.
   */
  type: FilesystemEventType
}

/**
 * Handle for watching a directory in the sandbox filesystem.
 *
 * Use {@link WatchHandle.stop} to stop watching the directory.
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
