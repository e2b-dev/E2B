import { expect, test } from 'vitest'

import { readLines } from '../src/utils'

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
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0xe4, 0xbd]))
      controller.close()
    },
  })
  const lines: string[] = []

  for await (const line of readLines(stream)) {
    lines.push(line)
  }

  expect(lines).toEqual(['\uFFFD'])
})
