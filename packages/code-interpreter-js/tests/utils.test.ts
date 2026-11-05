import { expect, test } from 'vitest'

import { readLines } from '../src/utils'

function streamFromChunks(chunks: (string | Uint8Array)[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
        )
      }
      controller.close()
    },
  })
}

async function collectLines(stream: ReadableStream<Uint8Array>) {
  const lines: string[] = []
  for await (const line of readLines(stream)) {
    lines.push(line)
  }
  return lines
}

test.each([1, 2, 3, 4, 7])(
  'preserves UTF-8 output split into %s-byte chunks',
  async (chunkSize) => {
    const expected = ['{"text":"你好 🌍 café"}', '{"text":"日本語 🚀"}']
    const bytes = new TextEncoder().encode(expected.join('\n'))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize))
        }
        controller.close()
      },
    })
    const lines: string[] = []

    for await (const line of readLines(stream)) {
      lines.push(line)
    }

    expect(lines).toEqual(expected)
    expect(stream.locked).toBe(false)
  }
)

test.each(['', 'first\n\nlast\n', 'first\nlast', '🌍\n你好\n'])(
  'preserves complete lines and an unterminated final line: %j',
  async (text) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    })
    const lines: string[] = []

    for await (const line of readLines(stream)) {
      lines.push(line)
    }

    const expected = text.split('\n')
    if (expected.at(-1) === '') expected.pop()
    expect(lines).toEqual(expected)
  }
)

test('flushes an incomplete UTF-8 sequence when the stream ends', async () => {
  const lines = await collectLines(
    streamFromChunks([new Uint8Array([0xe4, 0xbd])])
  )

  expect(lines).toEqual(['\uFFFD'])
})

test('emits a long single line assembled from many small chunks intact', async () => {
  // Regression test for https://github.com/e2b-dev/E2B/issues/1990:
  // outputs like base64 images or wide DataFrames are one long line.
  const line = 'x'.repeat(1024 * 1024)
  const chunkSize = 1024
  const chunks: string[] = []
  for (let offset = 0; offset < line.length; offset += chunkSize) {
    chunks.push(line.slice(offset, offset + chunkSize))
  }
  const lines = await collectLines(streamFromChunks(chunks))

  expect(lines).toEqual([line])
})

test('keeps \\r when splitting on \\n', async () => {
  const lines = await collectLines(streamFromChunks(['a\r\nb\r\nc\r']))

  expect(lines).toEqual(['a\r', 'b\r', 'c\r'])
})

test('splits a newline that straddles a chunk boundary', async () => {
  const lines = await collectLines(streamFromChunks(['a\r', '\nb']))

  expect(lines).toEqual(['a\r', 'b'])
})

test('yields nothing for an empty stream', async () => {
  const lines = await collectLines(streamFromChunks([]))

  expect(lines).toEqual([])
})

test('ignores leading empty chunks', async () => {
  const lines = await collectLines(
    streamFromChunks([new Uint8Array(0), 'a\n', new Uint8Array(0), 'b'])
  )

  expect(lines).toEqual(['a', 'b'])
})
