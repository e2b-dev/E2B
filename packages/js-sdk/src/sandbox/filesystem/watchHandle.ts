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
  private stopped = false
  // True only while `handleEvents` is awaiting the `onExit` callback. Lets
  // `stop()` detect a re-entrant call from inside `onExit` and skip awaiting
  // `handlingEvents`, which would otherwise deadlock.
  private inOnExit = false
  private notifyStopped!: () => void
  private readonly stoppedPromise = new Promise<void>((resolve) => {
    this.notifyStopped = resolve
  })
  private readonly handlingEvents: Promise<void>

  constructor(
    private readonly handleStop: () => void,
    private readonly events: AsyncIterable<WatchDirResponse>,
    private readonly onEvent?: (event: FilesystemEvent) => void | Promise<void>,
    private readonly onExit?: (err?: Error) => void | Promise<void>,
    private readonly checkHealth?: SandboxHealthCheck
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
   *
   * Safe to call (and `await`) from within an `onEvent` or `onExit` callback:
   * such a re-entrant call returns once the teardown it triggered is underway
   * instead of awaiting `handlingEvents`, which would otherwise deadlock.
   */
  async stop() {
    this.stopped = true
    this.notifyStopped()
    this.handleStop()
    // When `stop()` is called from inside `onExit`, awaiting `handlingEvents`
    // would deadlock: it cannot settle until `onExit` returns, and `onExit` is
    // blocked awaiting this call. `onExit` already received the exit error as
    // its argument, so returning early loses nothing.
    if (this.inOnExit) {
      return
    }
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
      throw await handleRpcErrorWithHealthCheck(err, this.checkHealth)
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

        const callback = this.onEvent?.({
          name: event.value.name,
          type: eventType,
          entry: event.value.entry
            ? mapEntryInfo(event.value.entry)
            : undefined,
        })

        if (callback) {
          // Track the callback's settlement so a callback that has already
          // resolved or rejected always wins over a concurrent stop(); only a
          // callback that is still pending when stop() wins is abandoned. The
          // tracking promise never rejects (both outcomes are handled), so an
          // abandoned callback's later rejection cannot crash the process.
          let settled = false
          let callbackError: Error | undefined
          const tracked = Promise.resolve(callback).then(
            () => {
              settled = true
            },
            (err) => {
              settled = true
              callbackError = err as Error
            }
          )

          await Promise.race([tracked, this.stoppedPromise])

          if (settled) {
            if (callbackError) {
              // Errors thrown by the onEvent callback are reported via onExit.
              error = callbackError
              break
            }
          } else {
            // The watch was stopped while the callback was still in flight —
            // abandon it (the JS equivalent of the cancelled handler task in
            // the Python SDK). Awaiting it here could deadlock when stop() is
            // awaited from inside the callback itself.
            break
          }
        }
      }
    } catch (err) {
      // Stopping the watch aborts the event stream, which surfaces here as a
      // cancellation error — report a user-initiated stop as a clean exit.
      if (!this.stopped) {
        error = err as Error
      }
    }

    this.inOnExit = true
    try {
      await this.onExit?.(error)
    } finally {
      this.inOnExit = false
      this.handleStop()
    }
  }
}
