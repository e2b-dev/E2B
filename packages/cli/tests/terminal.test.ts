import type { Sandbox } from 'e2b'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { spawnConnectedTerminal } from '../src/terminal'

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createInputHandle(
  sendImplementation: (data: Buffer) => Promise<void> = async () => {}
) {
  return {
    send: vi.fn<(data: Buffer) => Promise<void>>(async (data: Buffer) =>
      sendImplementation(data)
    ),
    close: vi.fn(async () => {}),
  }
}

function sentChunks(handle: ReturnType<typeof createInputHandle>) {
  const calls = handle.send.mock.calls as [Buffer][]
  return calls.map(([data]) => data.toString())
}

function createSandbox(handles: ReturnType<typeof createInputHandle>[]) {
  const wait = createDeferred()
  let nextHandle = 0
  const streamInput = vi.fn(
    () => handles[nextHandle++] ?? handles[handles.length - 1]
  )
  const sandbox = {
    pty: {
      create: vi.fn().mockResolvedValue({
        pid: 1,
        wait: () => wait.promise,
      }),
      resize: vi.fn().mockResolvedValue(undefined),
      streamInput,
    },
  } as unknown as Sandbox

  return { sandbox, streamInput, wait }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
const originalRawModeDescriptor = Object.getOwnPropertyDescriptor(
  process.stdin,
  'setRawMode'
)
let setRawModeMock = vi.fn()

beforeEach(() => {
  setRawModeMock = vi.fn()
  Object.defineProperty(process.stdin, 'setRawMode', {
    configurable: true,
    writable: true,
    value: setRawModeMock,
  })
  vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  if (originalRawModeDescriptor) {
    Object.defineProperty(
      process.stdin,
      'setRawMode',
      originalRawModeDescriptor
    )
  } else {
    Reflect.deleteProperty(process.stdin, 'setRawMode')
  }
})

describe('spawnConnectedTerminal input stream', () => {
  test('sends chunks in order over one persistent stream', async () => {
    const handle = createInputHandle()
    const { sandbox, streamInput, wait } = createSandbox([handle])
    const terminal = spawnConnectedTerminal(sandbox)

    try {
      await flush()
      process.stdin.emit('data', Buffer.from('first'))
      process.stdin.emit('data', Buffer.from('second'))
      await flush()

      expect(streamInput).toHaveBeenCalledTimes(1)
      expect(streamInput).toHaveBeenCalledWith(1, { timeoutMs: 0 })
      expect(sentChunks(handle)).toEqual(['first', 'second'])
    } finally {
      wait.resolve()
      await terminal
    }
  })

  test('reopens once per failed handle and resends chunks in order', async () => {
    const first = createInputHandle(async () => {
      throw new Error('first stream failed')
    })
    const replacement = createInputHandle()
    const { sandbox, streamInput, wait } = createSandbox([first, replacement])
    const terminal = spawnConnectedTerminal(sandbox)

    try {
      await flush()
      process.stdin.emit('data', Buffer.from('first'))
      process.stdin.emit('data', Buffer.from('second'))
      await flush()

      expect(streamInput).toHaveBeenCalledTimes(2)
      expect(streamInput).toHaveBeenNthCalledWith(1, 1, { timeoutMs: 0 })
      expect(streamInput).toHaveBeenNthCalledWith(2, 1, { timeoutMs: 0 })
      expect(sentChunks(replacement)).toEqual(['first', 'second'])

      process.stdin.emit('data', Buffer.from('later'))
      await flush()

      expect(sentChunks(replacement)).toEqual(['first', 'second', 'later'])
    } finally {
      wait.resolve()
      await terminal
    }
  })

  test('reports repeated resend failures only once', async () => {
    const first = createInputHandle(async () => {
      throw new Error('first stream failed')
    })
    const replacement = createInputHandle(async () => {
      throw new Error('replacement stream failed')
    })
    const finalHandle = createInputHandle()
    const { sandbox, streamInput, wait } = createSandbox([
      first,
      replacement,
      finalHandle,
    ])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const terminal = spawnConnectedTerminal(sandbox)

    try {
      await flush()
      process.stdin.emit('data', Buffer.from('first'))
      process.stdin.emit('data', Buffer.from('second'))
      await flush()

      expect(streamInput).toHaveBeenCalledTimes(3)
      expect(sentChunks(replacement)).toEqual(['first', 'second'])
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(
        'Error sending input:',
        expect.any(Error)
      )
    } finally {
      wait.resolve()
      await terminal
    }
  })

  test('cleans up listeners, closes the input stream, and disables raw mode', async () => {
    const handle = createInputHandle()
    const { sandbox, wait } = createSandbox([handle])
    const stdinListeners = process.stdin.listenerCount('data')
    const resizeListeners = process.stdout.listenerCount('resize')
    const terminal = spawnConnectedTerminal(sandbox)

    try {
      await flush()
      expect(process.stdin.listenerCount('data')).toBe(stdinListeners + 1)
      expect(process.stdout.listenerCount('resize')).toBe(resizeListeners + 1)
    } finally {
      wait.resolve()
      await terminal
    }

    expect(process.stdin.listenerCount('data')).toBe(stdinListeners)
    expect(process.stdout.listenerCount('resize')).toBe(resizeListeners)
    expect(handle.close).toHaveBeenCalledOnce()
    expect(setRawModeMock).toHaveBeenCalledWith(false)
  })
})
