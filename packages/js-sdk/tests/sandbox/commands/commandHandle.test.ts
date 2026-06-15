import { describe, expect, it, vi } from 'vitest'

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
})
