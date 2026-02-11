import { PassThrough, Readable } from 'node:stream'
import { describe, expect, test } from 'vitest'

import {
  buildCommand,
  chunkBytesBySize,
  isPipedStdin,
  readStdinIfPiped,
  readStdinFrom,
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

  test('readStdinFrom reads full input and resolves on EOF', async () => {
    const stream = Readable.from(['foo', 'bar'])
    await expect(readStdinFrom(stream)).resolves.toEqual(Buffer.from('foobar'))
  })

  test('readStdinFrom handles EOF without trailing newline', async () => {
    const stream = Readable.from(['no-newline'])
    await expect(readStdinFrom(stream)).resolves.toEqual(
      Buffer.from('no-newline')
    )
  })

  test('readStdinIfPiped returns undefined when stdin is not a pipe', async () => {
    const fsMock = {
      fstatSync: () => ({ isFIFO: () => false }),
    }
    const stream = new PassThrough()
    stream.end('data')
    await expect(readStdinIfPiped({ fsModule: fsMock, stream })).resolves.toBe(
      undefined
    )
  })

  test('readStdinIfPiped reads from provided stream when piped', async () => {
    const fsMock = {
      fstatSync: () => ({ isFIFO: () => true }),
    }
    const stream = new PassThrough()
    const promise = readStdinIfPiped({ fsModule: fsMock, stream })
    stream.write(Buffer.from([0xe2, 0x98]))
    stream.write(Buffer.from([0x83]))
    stream.end(Buffer.from([0x21]))
    await expect(promise).resolves.toEqual(Buffer.from([0xe2, 0x98, 0x83, 0x21]))
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

  test('chunkBytesBySize splits large input into byte-sized chunks', () => {
    const maxBytes = 64 * 1024
    const data = Buffer.from('a'.repeat(maxBytes * 2 + 1))
    const chunks = chunkBytesBySize(data, maxBytes)

    expect(chunks).toHaveLength(3)
    expect(chunks[0].byteLength).toBe(maxBytes)
    expect(chunks[1].byteLength).toBe(maxBytes)
    expect(chunks[2].byteLength).toBe(1)
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(data)
  })

  test('chunkBytesBySize keeps byte content intact', () => {
    const maxBytes = 64 * 1024
    const data = Buffer.from('\u{1F600}'.repeat(20000)) // 😀 (4 bytes each)
    const chunks = chunkBytesBySize(data, maxBytes)

    for (const chunk of chunks) {
      expect(chunk.byteLength).toBeLessThanOrEqual(maxBytes)
    }
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(data)
  })

  test('chunkBytesBySize returns empty array for empty input', () => {
    const chunks = chunkBytesBySize(Buffer.alloc(0), 64 * 1024)
    expect(chunks).toHaveLength(0)
  })

  test('chunkBytesBySize returns single chunk for small input', () => {
    const data = Buffer.from('hello')
    const chunks = chunkBytesBySize(data, 64 * 1024)
    expect(chunks).toHaveLength(1)
    expect(Buffer.from(chunks[0])).toEqual(data)
  })

  test('chunkBytesBySize throws on invalid maxBytes', () => {
    expect(() => chunkBytesBySize(Buffer.from('data'), 0)).toThrow()
    expect(() => chunkBytesBySize(Buffer.from('data'), -1)).toThrow()
  })

  test('readStdinFrom resolves with empty buffer on immediate EOF', async () => {
    const stream = Readable.from([])
    await expect(readStdinFrom(stream)).resolves.toEqual(Buffer.alloc(0))
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
})
