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
