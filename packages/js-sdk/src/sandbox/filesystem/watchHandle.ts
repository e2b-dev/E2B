import {
  handleRpcErrorWithHealthCheck,
  SandboxHealthCheck,
} from '../../envd/rpc'
import {
  EventType,
  WatchDirResponse,
} from '../../envd/filesystem/filesystem_pb'
import { EntryInfo, mapEntryInfo } from './index'

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
  /**
   * Information about the entry that triggered the event.
   *
   * Only populated when the watch was started with `includeEntry: true` and the
   * sandbox's envd version supports it. It may be `undefined` for events where the
   * entry no longer exists at the path (e.g. remove or rename-away events).
   */
  entry?: EntryInfo
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
    private readonly onExit?: (err?: Error) => void | Promise<void>,
    private readonly checkHealth?: SandboxHealthCheck
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
      throw await handleRpcErrorWithHealthCheck(err, this.checkHealth)
    }
  }

  private async handleEvents() {
    let iterationError: Error | undefined
    try {
      for await (const event of this.iterateEvents()) {
        const eventType = mapEventType(event.value.type)
        if (eventType === undefined) {
          continue
        }

        // Await the callback so an async `onEvent` that rejects is routed to
        // `onExit` below (instead of becoming an unhandled promise rejection
        // that can crash Node) and so the user can apply backpressure. Mirrors
        // `CommandHandle.handleEvents`.
        await this.onEvent?.({
          name: event.value.name,
          type: eventType,
          entry: event.value.entry
            ? mapEntryInfo(event.value.entry)
            : undefined,
        })
      }
    } catch (err) {
      iterationError = err as Error
    }

    try {
      // Invoke `onExit` exactly once: with the error when the watch ended
      // because of one, or with no argument on a clean end.
      if (iterationError) {
        await this.onExit?.(iterationError)
      } else {
        await this.onExit?.()
      }
    } catch {
      // `onExit` is the terminal callback; an error it throws has nowhere to
      // propagate in this detached handler, so it's swallowed to avoid an
      // unhandled promise rejection (the failure mode this guards against).
    } finally {
      this.handleStop()
    }
  }
}
