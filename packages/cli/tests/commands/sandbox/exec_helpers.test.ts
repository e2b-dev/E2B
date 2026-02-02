import { PassThrough, Readable } from 'node:stream'
import { describe, expect, test } from 'vitest'

import {
  buildCommand,
  chunkStringByBytes,
  isPipedStdin,
  readStdinIfPiped,
  readStdinFrom,
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
    await expect(readStdinFrom(stream)).resolves.toBe('foobar')
  })

  test('readStdinFrom handles EOF without trailing newline', async () => {
    const stream = Readable.from(['no-newline'])
    await expect(readStdinFrom(stream)).resolves.toBe('no-newline')
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
    await expect(promise).resolves.toBe('\u2603!')
  })

  test('isPipedStdin returns true for FIFO', () => {
    const fsMock = {
      fstatSync: () => ({ isFIFO: () => true }),
    }
    expect(isPipedStdin(0, fsMock)).toBe(true)
  })

  test('isPipedStdin returns false for non-FIFO or errors', () => {
    const fsMockFalse = {
      fstatSync: () => ({ isFIFO: () => false }),
    }
    expect(isPipedStdin(0, fsMockFalse)).toBe(false)

    const fsMockThrow = {
      fstatSync: () => {
        throw new Error('fail')
      },
    }
    expect(isPipedStdin(0, fsMockThrow)).toBe(false)
  })

  test('chunkStringByBytes splits large input into byte-sized chunks', () => {
    const maxBytes = 64 * 1024
    const data = 'a'.repeat(maxBytes * 2 + 1)
    const chunks = chunkStringByBytes(data, maxBytes)

    expect(chunks).toHaveLength(3)
    expect(Buffer.byteLength(chunks[0])).toBe(maxBytes)
    expect(Buffer.byteLength(chunks[1])).toBe(maxBytes)
    expect(Buffer.byteLength(chunks[2])).toBe(1)
    expect(chunks.join('')).toBe(data)
  })

  test('chunkStringByBytes keeps UTF-8 characters intact', () => {
    const maxBytes = 64 * 1024
    const data = '\u{1F600}'.repeat(20000) // 😀 (4 bytes each)
    const chunks = chunkStringByBytes(data, maxBytes)

    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk)).toBeLessThanOrEqual(maxBytes)
    }
    expect(chunks.join('')).toBe(data)
  })

  test('chunkStringByBytes throws on invalid maxBytes', () => {
    expect(() => chunkStringByBytes('data', 0)).toThrow()
    expect(() => chunkStringByBytes('data', -1)).toThrow()
  })
})
