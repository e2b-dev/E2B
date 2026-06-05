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

  it('wait resolves at the terminal end event without waiting for stream close', async () => {
    // Faithfully model the connect-es response stream: its iterator exposes
    // only `next()` (no `return`/`throw`), and a read issued after the terminal
    // end event stays open until the request is cancelled — mirroring envd
    // delaying the HTTP stream close. The transport only releases its resources
    // (connection + per-call deadline timer) when that read settles, so the
    // handle must cancel the request and pump one more read rather than just
    // abandoning the iterator.
    const requestAbort = new AbortController()
    let postEndReadSettled = false

    const events: AsyncIterable<any> = {
      [Symbol.asyncIterator]() {
        let stage = 0
        return {
          next() {
            stage += 1
            if (stage === 1) {
              return Promise.resolve({
                done: false,
                value: {
                  event: {
                    event: {
                      case: 'data',
                      value: {
                        output: {
                          case: 'stdout',
                          value: new TextEncoder().encode('hello'),
                        },
                      },
                    },
                  },
                },
              })
            }
            if (stage === 2) {
              return Promise.resolve({
                done: false,
                value: {
                  event: {
                    event: {
                      case: 'end',
                      value: { exitCode: 0, error: undefined },
                    },
                  },
                },
              })
            }
            // Post-end read: only settles once the request is cancelled.
            return new Promise((_resolve, reject) => {
              const onAbort = () => {
                postEndReadSettled = true
                reject(new Error('canceled'))
              }
              if (requestAbort.signal.aborted) {
                onAbort()
              } else {
                requestAbort.signal.addEventListener('abort', onAbort, {
                  once: true,
                })
              }
            })
          },
        }
      },
    }

    const handleDisconnect = vi.fn(() => requestAbort.abort())

    const handle = new CommandHandle(
      1,
      handleDisconnect,
      async () => true,
      events
    )

    const result = await handle.wait()

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('hello')
    // The request must be cancelled to release the connection...
    expect(handleDisconnect).toHaveBeenCalled()
    // ...and a read must be pumped after the cancellation so the transport can
    // clean up. Simply returning from the iterator (the previous behaviour)
    // would leave this read — and the deadline timer — dangling.
    expect(postEndReadSettled).toBe(true)
  })
})
