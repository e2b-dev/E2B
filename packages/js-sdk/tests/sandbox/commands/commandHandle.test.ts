import { Code, ConnectError } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'

import { SandboxError, TimeoutError } from '../../../src/errors'
import { CommandHandle } from '../../../src/sandbox/commands/commandHandle'

type EventKind = 'stdout' | 'stderr' | 'pty'

function createEvents(kind: EventKind): AsyncIterable<any> {
  async function* events() {
    if (kind === 'pty') {
      yield {
        event: {
          event: {
            case: 'data',
            value: {
              output: {
                case: 'pty',
                value: new Uint8Array([1, 2, 3]),
              },
            },
          },
        },
      }
    } else {
      yield {
        event: {
          event: {
            case: 'data',
            value: {
              output: {
                case: kind,
                value: new TextEncoder().encode(kind),
              },
            },
          },
        },
      }
    }

    yield {
      event: {
        event: {
          case: 'end',
          value: {
            exitCode: 0,
            error: undefined,
          },
        },
      },
    }
  }

  return events()
}

function dataEvent(kind: 'stdout' | 'stderr', value: Uint8Array) {
  return {
    event: {
      event: {
        case: 'data',
        value: {
          output: {
            case: kind,
            value,
          },
        },
      },
    },
  }
}

function endEvent(exitCode = 0) {
  return {
    event: {
      event: {
        case: 'end',
        value: {
          exitCode,
          error: undefined,
        },
      },
    },
  }
}

// An async iterable whose events are delivered on demand. Lets a test hold the
// handle's event loop blocked on `next()` (idle between bursts) and then push a
// late event to simulate stdout arriving after `disconnect()` — the transport
// condition that triggers the production leak. `return()` (called when the
// handle's `for await` breaks) unblocks any pending read, mirroring the stream
// being torn down from the client side.
function createControllableEvents() {
  const queue: any[] = []
  let pending: ((result: IteratorResult<any>) => void) | undefined
  let closed = false

  const iterator: AsyncIterator<any> = {
    next() {
      if (queue.length > 0) {
        return Promise.resolve({ value: queue.shift(), done: false })
      }
      if (closed) {
        return Promise.resolve({ value: undefined, done: true })
      }
      return new Promise((resolve) => {
        pending = resolve
      })
    },
    return() {
      closed = true
      if (pending) {
        const resolve = pending
        pending = undefined
        resolve({ value: undefined, done: true })
      }
      return Promise.resolve({ value: undefined, done: true })
    },
  }

  return {
    events: { [Symbol.asyncIterator]: () => iterator } as AsyncIterable<any>,
    push(event: any) {
      if (pending) {
        const resolve = pending
        pending = undefined
        resolve({ value: event, done: false })
      } else {
        queue.push(event)
      }
    },
  }
}

describe('CommandHandle', () => {
  it.each<EventKind>(['stdout', 'stderr', 'pty'])(
    'wait awaits async %s callbacks',
    async (kind) => {
      let callbackStarted = false
      let releaseCallback: (() => void) | undefined

      const callbackBlocked = new Promise<void>((resolve) => {
        releaseCallback = resolve
      })

      const callback = async () => {
        callbackStarted = true
        await callbackBlocked
      }

      const handle = new CommandHandle(
        1,
        () => {},
        async () => true,
        createEvents(kind),
        kind === 'stdout' ? callback : undefined,
        kind === 'stderr' ? callback : undefined,
        kind === 'pty' ? callback : undefined
      )

      let waitResolved = false
      const waitPromise = handle.wait().then(() => {
        waitResolved = true
      })

      await vi.waitFor(() => {
        expect(callbackStarted).toBe(true)
      })
      expect(waitResolved).toBe(false)

      releaseCallback?.()
      await waitPromise

      expect(waitResolved).toBe(true)
    }
  )

  it('decodes multibyte characters split across chunks', async () => {
    const emojiBytes = new TextEncoder().encode('😀')

    async function* events() {
      yield dataEvent(
        'stdout',
        new Uint8Array([
          ...new TextEncoder().encode('a'),
          ...emojiBytes.slice(0, 2),
        ])
      )
      yield dataEvent(
        'stdout',
        new Uint8Array([
          ...emojiBytes.slice(2),
          ...new TextEncoder().encode('b'),
        ])
      )
      yield dataEvent('stderr', emojiBytes.slice(0, 3))
      yield dataEvent('stderr', emojiBytes.slice(3))
      yield endEvent()
    }

    const stdoutChunks: string[] = []
    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      events(),
      (out) => {
        stdoutChunks.push(out)
      }
    )

    const result = await handle.wait()

    expect(result.stdout).toBe('a😀b')
    expect(result.stderr).toBe('😀')
    expect(result.stdout).not.toContain('�')
    expect(result.stderr).not.toContain('�')
    expect(stdoutChunks.join('')).toBe('a😀b')
  })

  it('replaces incomplete trailing utf-8 sequences at the end of the stream', async () => {
    const emojiBytes = new TextEncoder().encode('😀')

    async function* events() {
      yield dataEvent(
        'stdout',
        new Uint8Array([
          ...new TextEncoder().encode('a'),
          ...emojiBytes.slice(0, 2),
        ])
      )
      yield endEvent()
    }

    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      events()
    )

    const result = await handle.wait()

    expect(result.stdout).toBe('a�')
  })

  it('flushes incomplete trailing utf-8 sequences when the stream closes without an end event', async () => {
    const emojiBytes = new TextEncoder().encode('😀')

    async function* events() {
      yield dataEvent(
        'stdout',
        new Uint8Array([
          ...new TextEncoder().encode('a'),
          ...emojiBytes.slice(0, 2),
        ])
      )
    }

    const stdoutChunks: string[] = []
    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      events(),
      (out) => {
        stdoutChunks.push(out)
      }
    )

    // No end event arrives, so wait() rejects, but the buffered bytes must
    // still be flushed to the stdout callback as a replacement character.
    await expect(handle.wait()).rejects.toThrow()

    expect(stdoutChunks.join('')).toBe('a�')
  })

  it('flushes incomplete trailing utf-8 sequences when the stream errors', async () => {
    const emojiBytes = new TextEncoder().encode('😀')

    async function* events() {
      yield dataEvent(
        'stdout',
        new Uint8Array([
          ...new TextEncoder().encode('a'),
          ...emojiBytes.slice(0, 2),
        ])
      )
      throw new Error('stream died')
    }

    const stdoutChunks: string[] = []
    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      events(),
      (out) => {
        stdoutChunks.push(out)
      }
    )

    // The stream errors before an end event arrives, so wait() rejects, but the
    // buffered bytes must still be flushed to the stdout callback as a
    // replacement character.
    await expect(handle.wait()).rejects.toThrow()

    expect(stdoutChunks.join('')).toBe('a�')
  })

  it('onStdout stops firing after await disconnect()', async () => {
    const controllable = createControllableEvents()
    const chunks: string[] = []

    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      controllable.events,
      (out) => {
        chunks.push(out)
      }
    )

    // First burst is delivered to the live subscriber.
    controllable.push(dataEvent('stdout', new TextEncoder().encode('a')))
    await vi.waitFor(() => {
      expect(chunks).toEqual(['a'])
    })

    // Disconnect while the event loop is idle (blocked on the next read), then
    // push a late event — as if stdout arrived after the abort but before the
    // stream was torn down. The late event must never reach the callback.
    await handle.disconnect()
    controllable.push(dataEvent('stdout', new TextEncoder().encode('b')))
    await new Promise((r) => setTimeout(r, 0))

    expect(chunks).toEqual(['a'])

    // Any further output is ignored too.
    controllable.push(dataEvent('stdout', new TextEncoder().encode('c')))
    await new Promise((r) => setTimeout(r, 0))
    expect(chunks).toEqual(['a'])
  })

  it('disconnect() resolves promptly when a stream is idle', async () => {
    // An idle long-running command (e.g. `sleep`) produces no further output,
    // so the event handler stays blocked on the next read. disconnect() must
    // not wait for that read and must resolve right away.
    const controllable = createControllableEvents()
    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      controllable.events,
      () => {}
    )

    // No event is ever pushed; this would hang if disconnect() awaited the
    // event handler.
    await handle.disconnect()
  })

  it('disconnect() does not block on an in-flight callback', async () => {
    const controllable = createControllableEvents()
    let callbackStarted = false
    let releaseCallback: (() => void) | undefined
    const callbackBlocked = new Promise<void>((resolve) => {
      releaseCallback = resolve
    })

    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      controllable.events,
      async () => {
        callbackStarted = true
        await callbackBlocked
      }
    )

    controllable.push(dataEvent('stdout', new TextEncoder().encode('a')))
    await vi.waitFor(() => {
      expect(callbackStarted).toBe(true)
    })

    // The callback is still in flight; disconnect() must resolve without
    // waiting for it to settle.
    await handle.disconnect()

    // Releasing the callback afterwards is harmless.
    releaseCallback?.()
  })

  it('disconnect() resolves when called from inside a callback', async () => {
    const controllable = createControllableEvents()
    let disconnectReturned = false

    const handle: CommandHandle = new CommandHandle(
      1,
      () => {},
      async () => true,
      controllable.events,
      async () => {
        await handle.disconnect()
        disconnectReturned = true
      }
    )

    controllable.push(dataEvent('stdout', new TextEncoder().encode('a')))
    await vi.waitFor(() => {
      expect(disconnectReturned).toBe(true)
    })
  })

  it('records the exit code when disconnected before an end event with trailing bytes', async () => {
    const controllable = createControllableEvents()
    const emojiBytes = new TextEncoder().encode('😀')
    const chunks: string[] = []

    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      controllable.events,
      (out) => {
        chunks.push(out)
      }
    )

    // First chunk leaves an incomplete multibyte sequence buffered in the
    // decoder, so the end event will flush a trailing replacement character.
    controllable.push(
      dataEvent(
        'stdout',
        new Uint8Array([
          ...new TextEncoder().encode('a'),
          ...emojiBytes.slice(0, 2),
        ])
      )
    )
    await vi.waitFor(() => {
      expect(chunks).toEqual(['a'])
    })

    // Disconnect, then the process exits. The end event carries a flushed
    // chunk; wait() must still surface the exit code instead of failing as if
    // the process never produced a result.
    await handle.disconnect()
    controllable.push(endEvent(0))

    const result = await handle.wait()
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('a�')
    // The flushed chunk was produced after disconnect, so it must not reach
    // the live callback.
    expect(chunks).toEqual(['a'])
  })

  it('surfaces an async callback error through wait()', async () => {
    async function* events() {
      yield dataEvent('stdout', new TextEncoder().encode('a'))
      yield endEvent()
    }

    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      events(),
      async () => {
        throw new Error('callback failed')
      }
    )

    await expect(handle.wait()).rejects.toThrow('callback failed')
  })
})

// An event stream that delivers `initial`, then stays idle until it is aborted
// and fails the pending read with the `Canceled` error Connect raises for an
// aborted request — what the real transport does when the handle's
// `handleDisconnect` aborts it.
function createAbortableEvents(initial: any[] = []) {
  const controller = new AbortController()

  async function* events() {
    yield* initial
    await new Promise<never>((_, reject) => {
      const fail = () =>
        reject(new ConnectError('This operation was aborted', Code.Canceled))
      // The stream may already be aborted by the time the read starts.
      if (controller.signal.aborted) {
        fail()
        return
      }
      controller.signal.addEventListener('abort', fail, { once: true })
    })
  }

  return { events: events(), abort: () => controller.abort() }
}

describe('CommandHandle.disconnect()', () => {
  it.each<'stdout' | 'pty'>(['stdout', 'pty'])(
    'makes a pending wait() reject with a SandboxError, not a TimeoutError (%s)',
    async (kind) => {
      const abortable = createAbortableEvents()
      const handle = new CommandHandle(
        1,
        abortable.abort,
        async () => true,
        abortable.events,
        kind === 'stdout' ? () => {} : undefined,
        undefined,
        kind === 'pty' ? () => {} : undefined
      )

      const waiting = handle.wait()
      await handle.disconnect()

      const err = await waiting.catch((e) => e)
      expect(err).toBeInstanceOf(SandboxError)
      expect(err).not.toBeInstanceOf(TimeoutError)
      expect(err.message).toMatch(/disconnected before the command finished/i)
    }
  )

  it('makes a later wait() reject with the same SandboxError', async () => {
    const abortable = createAbortableEvents()
    const handle = new CommandHandle(
      1,
      abortable.abort,
      async () => true,
      abortable.events
    )

    await handle.disconnect()

    const err = await handle.wait().catch((e) => e)
    expect(err).toBeInstanceOf(SandboxError)
    expect(err).not.toBeInstanceOf(TimeoutError)
    expect(err.message).toMatch(/disconnected before the command finished/i)
  })

  it('keeps bytes buffered in the decoder in stdout, without a callback', async () => {
    const emojiBytes = new TextEncoder().encode('😀')
    const abortable = createAbortableEvents([
      dataEvent(
        'stdout',
        new Uint8Array([
          ...new TextEncoder().encode('a'),
          ...emojiBytes.slice(0, 2),
        ])
      ),
    ])
    const chunks: string[] = []
    const handle = new CommandHandle(
      1,
      abortable.abort,
      async () => true,
      abortable.events,
      (out) => {
        chunks.push(out)
      }
    )
    await vi.waitFor(() => {
      expect(chunks).toEqual(['a'])
    })

    await handle.disconnect()
    await handle.wait().catch(() => {})

    expect(handle.stdout).toBe('a�')
    expect(chunks).toEqual(['a'])
  })

  it('leaves stream errors on a handle that was not disconnected unchanged', async () => {
    const abortable = createAbortableEvents()
    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      abortable.events
    )

    const waiting = handle.wait()
    abortable.abort()

    await expect(waiting).rejects.toBeInstanceOf(TimeoutError)
  })

  it('still reports a callback error raised after disconnect()', async () => {
    const controllable = createControllableEvents()
    let failCallback: ((err: Error) => void) | undefined

    const handle = new CommandHandle(
      1,
      () => {},
      async () => true,
      controllable.events,
      () =>
        new Promise<void>((_, reject) => {
          failCallback = reject
        })
    )

    controllable.push(dataEvent('stdout', new TextEncoder().encode('a')))
    await vi.waitFor(() => {
      expect(failCallback).toBeDefined()
    })

    // The callback was already running when the handle disconnected, so its
    // failure is still the error wait() reports.
    await handle.disconnect()
    failCallback?.(new Error('callback failed'))

    await expect(handle.wait()).rejects.toThrow('callback failed')
  })
})
