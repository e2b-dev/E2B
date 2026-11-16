import { PassThrough, Readable } from 'node:stream'
import { describe, expect, test } from 'vitest'

import {
  buildCommand,
  isPipedStdin,
  streamStdinChunks,
  shellQuote,
} from '../../../src/commands/sandbox/exec_helpers'

describe('exec helpers', () => {
  test('shellQuote leaves safe args untouched', () => {
    expect(shellQuote('python3')).toBe('python3')
    expect(shellQuote('-c')).toBe('-c')
    expect(shellQuote('path/to/file.txt')).toBe('path/to/file.txt')
  })

  test('shellQuote wraps special chars and spaces', () => {
    expect(shellQuote('print(input())')).toBe("'print(input())'")
    expect(shellQuote('hello world')).toBe("'hello world'")
    expect(shellQuote("it's ok")).toBe("'it'\"'\"'s ok'")
    expect(shellQuote('')).toBe("''")
  })

  test('buildCommand returns a single command as-is', () => {
    const cmd = 'python3 -c "print(input())"'
    expect(buildCommand([cmd])).toBe(cmd)
  })

  test('buildCommand quotes args that need shell escaping', () => {
    expect(buildCommand(['python3', '-c', 'print(input())'])).toBe(
      "python3 -c 'print(input())'"
    )
    expect(buildCommand(['echo', 'hello world'])).toBe("echo 'hello world'")
    expect(buildCommand(['echo', "it's ok"])).toBe("echo 'it'\"'\"'s ok'")
  })

  test('buildCommand strips a leading -- separator', () => {
    expect(buildCommand(['--', 'codex', 'exec', '--help'])).toBe(
      'codex exec --help'
    )
  })

  test('buildCommand rejects a separator without a command', () => {
    expect(() => buildCommand(['--'])).toThrow('missing command to execute')
  })

  test('isPipedStdin returns true for FIFO', () => {
    const fsMock = {
      fstatSync: () => ({ isFIFO: () => true, isCharacterDevice: () => false }),
    }
    expect(isPipedStdin(0, fsMock)).toBe(true)
  })

  test('isPipedStdin returns true for file redirection', () => {
    const fsMock = {
      fstatSync: () => ({ isFile: () => true, isCharacterDevice: () => false }),
    }
    expect(isPipedStdin(0, fsMock)).toBe(true)
  })

  test('isPipedStdin returns false for interactive terminal', () => {
    const fsMock = {
      fstatSync: () => ({
        isCharacterDevice: () => true,
        isFIFO: () => false,
        isFile: () => false,
      }),
    }
    expect(isPipedStdin(0, fsMock)).toBe(false)
  })

  test('isPipedStdin returns false for non-FIFO or errors', () => {
    const fsMockFalse = {
      fstatSync: () => ({ isFIFO: () => false, isCharacterDevice: () => false }),
    }
    expect(isPipedStdin(0, fsMockFalse)).toBe(false)

    const fsMockThrow = {
      fstatSync: () => {
        throw new Error('fail')
      },
    }
    expect(isPipedStdin(0, fsMockThrow)).toBe(false)
  })

  test('streamStdinChunks delivers chunks incrementally before EOF', async () => {
    const stream = new PassThrough()
    const seen: Buffer[] = []
    let resolveFirstChunk: (() => void) | undefined
    const firstChunkSeen = new Promise<void>((resolve) => {
      resolveFirstChunk = resolve
    })
    const done = streamStdinChunks(
      stream,
      async (chunk) => {
        seen.push(Buffer.from(chunk))
        if (resolveFirstChunk) {
          resolveFirstChunk()
          resolveFirstChunk = undefined
        }
      },
      64 * 1024
    )

    stream.write('first')
    await firstChunkSeen

    expect(seen).toEqual([Buffer.from('first')])

    stream.end('second')
    await done

    expect(seen).toEqual([Buffer.from('first'), Buffer.from('second')])
  })

  test('streamStdinChunks splits oversized stream chunks by max bytes', async () => {
    const stream = Readable.from([Buffer.from('a'.repeat(64 * 1024 + 3))])
    const chunks: Uint8Array[] = []

    await streamStdinChunks(
      stream,
      async (chunk) => {
        chunks.push(chunk)
      },
      64 * 1024
    )

    expect(chunks).toHaveLength(2)
    expect(chunks[0].byteLength).toBe(64 * 1024)
    expect(chunks[1].byteLength).toBe(3)
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(
      Buffer.from('a'.repeat(64 * 1024 + 3))
    )
  })

  test('streamStdinChunks stops early when onChunk returns false', async () => {
    const stream = Readable.from([Buffer.from('first'), Buffer.from('second')])
    const chunks: Uint8Array[] = []

    await streamStdinChunks(
      stream,
      async (chunk) => {
        chunks.push(chunk)
        return false
      },
      64 * 1024
    )

    expect(chunks).toHaveLength(1)
    expect(Buffer.from(chunks[0])).toEqual(Buffer.from('first'))
  })
})
