import { handleRpcError } from '../../envd/rpc'
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
  private stopped = false
  private notifyStopped!: () => void
  private readonly stoppedPromise = new Promise<void>((resolve) => {
    this.notifyStopped = resolve
  })
  private readonly handlingEvents: Promise<void>

  constructor(
    private readonly handleStop: () => void,
    private readonly events: AsyncIterable<WatchDirResponse>,
    private readonly onEvent?: (event: FilesystemEvent) => void | Promise<void>,
    private readonly onExit?: (err?: Error) => void | Promise<void>
  ) {
    this.handlingEvents = this.handleEvents()
    // When the watch ends on its own and onExit throws, there is no caller to
    // receive the error — mark the promise as handled so it doesn't crash the
    // process. The error still surfaces if stop() is called later.
    this.handlingEvents.catch(() => {})
  }

  /**
   * Stop watching the directory.
   *
   * Resolves after the watching has fully ended and the `onExit` callback (if
   * any) has completed; errors thrown by `onExit` are re-thrown here. An
   * in-flight `onEvent` callback is abandoned, its result ignored.
   */
  async stop() {
    this.stopped = true
    this.notifyStopped()
    this.handleStop()
    await this.handlingEvents
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
    let error: Error | undefined

    try {
      for await (const event of this.iterateEvents()) {
        const eventType = mapEventType(event.value.type)
        if (eventType === undefined) {
          continue
        }

        try {
          const callback = this.onEvent?.({
            name: event.value.name,
            type: eventType,
            entry: event.value.entry
              ? mapEntryInfo(event.value.entry)
              : undefined,
          })

          if (callback) {
            const callbackStopped = await Promise.race([
              Promise.resolve(callback).then(() => false),
              this.stoppedPromise.then(() => true),
            ])
            if (callbackStopped) {
              // The watch was stopped while the callback was in flight —
              // abandon it (the JS equivalent of the cancelled handler task
              // in the Python SDK). Awaiting it here could deadlock when
              // stop() is awaited from inside the callback itself.
              Promise.resolve(callback).catch(() => {})
              break
            }
          }
        } catch (err) {
          // Errors thrown by the onEvent callback are reported via onExit.
          error = err as Error
          break
        }
      }
    } catch (err) {
      // Stopping the watch aborts the event stream, which surfaces here as a
      // cancellation error — report a user-initiated stop as a clean exit.
      if (!this.stopped) {
        error = err as Error
      }
    }

    try {
      await this.onExit?.(error)
    } finally {
      this.handleStop()
    }
  }
}
