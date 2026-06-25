import { describe, expect, it, vi } from 'vitest'

import { EventType } from '../../../src/envd/filesystem/filesystem_pb'
import {
  FilesystemEventType,
  WatchHandle,
} from '../../../src/sandbox/filesystem/watchHandle'

function filesystemEvent(name: string, type: EventType = EventType.WRITE) {
  return {
    event: {
      case: 'filesystem' as const,
      value: { name, type, entry: undefined },
    },
  }
}

function events(items: ReturnType<typeof filesystemEvent>[]) {
  async function* gen() {
    for (const item of items) {
      yield item as any
    }
  }
  return gen()
}

describe('WatchHandle', () => {
  it('awaits an async onEvent before finishing and firing onExit', async () => {
    let callbackStarted = false
    let releaseCallback: (() => void) | undefined
    const callbackBlocked = new Promise<void>((resolve) => {
      releaseCallback = resolve
    })

    const onEvent = async () => {
      callbackStarted = true
      await callbackBlocked
    }

    let exitCalled = false
    const onExit = () => {
      exitCalled = true
    }

    new WatchHandle(
      () => {},
      events([filesystemEvent('a.txt')]),
      onEvent,
      onExit
    )

    await vi.waitFor(() => {
      expect(callbackStarted).toBe(true)
    })
    // onExit must not fire while onEvent is still pending.
    expect(exitCalled).toBe(false)

    releaseCallback?.()
    await vi.waitFor(() => {
      expect(exitCalled).toBe(true)
    })
  })

  it('routes a rejecting async onEvent to onExit and stops the watch', async () => {
    const error = new Error('callback failed')

    let stopped = false
    let exitErr: Error | undefined | 'unset' = 'unset'

    new WatchHandle(
      () => {
        stopped = true
      },
      events([filesystemEvent('a.txt')]),
      async () => {
        throw error
      },
      (err) => {
        exitErr = err ?? undefined
      }
    )

    await vi.waitFor(() => {
      expect(exitErr).not.toBe('unset')
    })
    expect(exitErr).toBe(error)
    expect(stopped).toBe(true)
  })

  it('calls onExit with no argument when the stream ends cleanly', async () => {
    const received: FilesystemEventType[] = []
    let exitArgs: unknown[] | undefined

    new WatchHandle(
      () => {},
      events([filesystemEvent('a.txt')]),
      (event) => {
        received.push(event.type)
      },
      (...args: unknown[]) => {
        exitArgs = args
      }
    )

    await vi.waitFor(() => {
      expect(exitArgs).toBeDefined()
    })
    // No error is passed on a clean exit — onExit is called with zero args.
    expect(exitArgs).toEqual([])
    expect(received).toEqual([FilesystemEventType.WRITE])
  })

  it('does not let a throwing onExit become an unhandled rejection', async () => {
    let stopped = false

    new WatchHandle(
      () => {
        stopped = true
      },
      events([filesystemEvent('a.txt')]),
      () => {},
      () => {
        throw new Error('onExit failed')
      }
    )

    // handleStop runs after onExit, so observing the stop confirms the loop
    // ran the throwing onExit to completion. A leaked rejection would fail the
    // test run instead.
    await vi.waitFor(() => {
      expect(stopped).toBe(true)
    })
  })
})
