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
    async kind => {
      let callbackStarted = false
      let releaseCallback: (() => void) | undefined

      const callbackBlocked = new Promise<void>(resolve => {
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
})
