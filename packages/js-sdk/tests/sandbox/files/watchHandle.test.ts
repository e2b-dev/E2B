import { describe, expect, test } from 'vitest'

import {
  FilesystemEvent,
  WatchHandle,
} from '../../../src/sandbox/filesystem/watchHandle'
import {
  EventType,
  WatchDirResponse,
} from '../../../src/envd/filesystem/filesystem_pb'

function filesystemEvent(name: string): WatchDirResponse {
  return {
    event: {
      case: 'filesystem',
      value: { type: EventType.WRITE, name },
    },
  } as WatchDirResponse
}

async function* stream(...events: WatchDirResponse[]) {
  for (const event of events) {
    yield event
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('WatchHandle', () => {
  test('awaits async onEvent callbacks before handling the next event', async () => {
    const order: string[] = []
    const exited = deferred()

    new WatchHandle(
      () => {},
      stream(filesystemEvent('a'), filesystemEvent('b')),
      async (event: FilesystemEvent) => {
        order.push(`start:${event.name}`)
        await new Promise((r) => setTimeout(r, 10))
        order.push(`end:${event.name}`)
      },
      () => exited.resolve()
    )

    await exited.promise
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b'])
  })

  test('awaits async onExit before stopping the watcher', async () => {
    const order: string[] = []
    const stopped = deferred()

    new WatchHandle(
      () => {
        order.push('stop')
        stopped.resolve()
      },
      stream(),
      undefined,
      async () => {
        order.push('exit:start')
        await new Promise((r) => setTimeout(r, 10))
        order.push('exit:end')
      }
    )

    await stopped.promise
    expect(order).toEqual(['exit:start', 'exit:end', 'stop'])
  })

  test('calls onExit without an error when stopped by the user', async () => {
    const exited = deferred()
    let exitError: Error | undefined = new Error('sentinel')
    let abort!: (err: Error) => void
    const aborted = new Promise<never>((_, reject) => {
      abort = reject
    })

    async function* hangingStream(): AsyncGenerator<WatchDirResponse> {
      // `aborted` only ever rejects, so nothing is yielded.
      yield await aborted
    }

    const handle = new WatchHandle(
      () => abort(new Error('stream aborted')),
      hangingStream(),
      undefined,
      (err?: Error) => {
        exitError = err
        exited.resolve()
      }
    )

    await handle.stop()
    await exited.promise
    expect(exitError).toBeUndefined()
  })

  test('calls onExit with the error when the stream fails', async () => {
    const exited = deferred()
    let exitError: Error | undefined

    async function* failingStream(): AsyncGenerator<WatchDirResponse> {
      yield filesystemEvent('a')
      throw new Error('stream failed')
    }

    new WatchHandle(
      () => {},
      failingStream(),
      undefined,
      (err?: Error) => {
        exitError = err
        exited.resolve()
      }
    )

    await exited.promise
    expect(exitError?.message).toBe('stream failed')
  })

  test('stop resolves while an onEvent callback is still in flight', async () => {
    const exited = deferred()
    const eventStarted = deferred()
    let exitError: Error | undefined = new Error('sentinel')

    const handle = new WatchHandle(
      () => {},
      stream(filesystemEvent('a')),
      async () => {
        eventStarted.resolve()
        // never settles — stop() must not wait for it
        await new Promise(() => {})
      },
      (err?: Error) => {
        exitError = err
        exited.resolve()
      }
    )

    await eventStarted.promise
    await handle.stop()

    await exited.promise
    expect(exitError).toBeUndefined()
  })

  test('stop can be awaited from inside onEvent without deadlocking', async () => {
    const exited = deferred()
    let exitError: Error | undefined = new Error('sentinel')

    const handle = new WatchHandle(
      () => {},
      stream(filesystemEvent('a'), filesystemEvent('b')),
      async (event: FilesystemEvent) => {
        if (event.name === 'a') {
          await handle.stop()
        }
      },
      (err?: Error) => {
        exitError = err
        exited.resolve()
      }
    )

    await exited.promise
    expect(exitError).toBeUndefined()
  })

  test('stop can be awaited from inside onExit without deadlocking', async () => {
    const finished = deferred()
    let reentrantStopResolved = false

    const handle = new WatchHandle(
      () => {},
      stream(filesystemEvent('a')),
      undefined,
      async () => {
        // A re-entrant stop() from within onExit must not await handlingEvents
        // (which can only settle once this callback returns) or it deadlocks.
        await handle.stop()
        reentrantStopResolved = true
        finished.resolve()
      }
    )

    await finished.promise
    expect(reentrantStopResolved).toBe(true)
  })

  test('stop rethrows onExit error when called after the watch already ended', async () => {
    const exited = deferred()

    const handle = new WatchHandle(
      () => {},
      stream(),
      undefined,
      () => {
        exited.resolve()
        throw new Error('onExit failed')
      }
    )

    // Let the watch end on its own and onExit settle before stopping.
    await exited.promise
    await new Promise((r) => setTimeout(r, 0))

    await expect(handle.stop()).rejects.toThrow('onExit failed')
  })

  test('stop rethrows errors raised by onExit', async () => {
    let abort!: (err: Error) => void
    const aborted = new Promise<never>((_, reject) => {
      abort = reject
    })

    async function* hangingStream(): AsyncGenerator<WatchDirResponse> {
      // `aborted` only ever rejects, so nothing is yielded.
      yield await aborted
    }

    const handle = new WatchHandle(
      () => abort(new Error('stream aborted')),
      hangingStream(),
      undefined,
      () => {
        throw new Error('onExit failed')
      }
    )

    await expect(handle.stop()).rejects.toThrow('onExit failed')
  })

  test('reports onEvent rejection to onExit even when stop is requested concurrently', async () => {
    const exited = deferred()
    const eventStarted = deferred()
    const failCallback = deferred()
    let exitError: Error | undefined

    const handle = new WatchHandle(
      () => {},
      stream(filesystemEvent('a')),
      async () => {
        eventStarted.resolve()
        await failCallback.promise
        throw new Error('callback failed')
      },
      (err?: Error) => {
        exitError = err
        exited.resolve()
      }
    )

    await eventStarted.promise
    // Make the in-flight callback reject and request a stop in the same tick.
    failCallback.resolve()
    const stopping = handle.stop()

    await exited.promise
    await stopping
    expect(exitError?.message).toBe('callback failed')
  })

  test('routes async onEvent rejections to onExit', async () => {
    const exited = deferred()
    let exitError: Error | undefined

    new WatchHandle(
      () => {},
      stream(filesystemEvent('a')),
      async () => {
        throw new Error('callback failed')
      },
      (err?: Error) => {
        exitError = err
        exited.resolve()
      }
    )

    await exited.promise
    expect(exitError?.message).toBe('callback failed')
  })
})
