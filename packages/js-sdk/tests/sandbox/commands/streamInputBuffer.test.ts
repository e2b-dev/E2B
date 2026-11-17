import { Buffer } from 'node:buffer'
import { afterEach, expect, test, vi } from 'vitest'

import { Sandbox } from '../../../src'

afterEach(() => vi.unstubAllGlobals())

const textBytes = [111, 114, 105, 103, 105, 110, 97, 108]
const inputs = [
  { name: 'Buffer', make: () => Buffer.from('original'), expected: textBytes },
  {
    name: 'Buffer view',
    make: () => Buffer.from('xoriginaly').subarray(1, 9),
    expected: textBytes,
  },
  {
    name: 'Uint8Array',
    make: () => new TextEncoder().encode('original'),
    expected: textBytes,
  },
  {
    name: 'binary Buffer',
    make: () => Buffer.from([0, 255, 128, 0]),
    expected: [0, 255, 128, 0],
  },
  { name: 'string', make: () => 'original', expected: textBytes },
]

for (const channel of ['commands', 'pty'] as const) {
  test.each(inputs)(
    `${channel} preserves queued $name bytes`,
    async ({ make, expected }) => {
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const received: number[][] = []
      vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
        await gate
        const body = new Uint8Array(
          await new Response(options.body).arrayBuffer()
        )
        for (let offset = 0; offset < body.length;) {
          const length = new DataView(
            body.buffer,
            body.byteOffset + offset + 1,
            4
          ).getUint32(0)
          const message = JSON.parse(
            new TextDecoder().decode(
              body.subarray(offset + 5, offset + 5 + length)
            )
          )
          const input = message.data?.input?.stdin ?? message.data?.input?.pty
          if (input !== undefined)
            received.push(Array.from(Buffer.from(input, 'base64')))
          offset += 5 + length
        }
        // Connect JSON response message followed by the end-stream envelope.
        return new Response(
          new Uint8Array([0, 0, 0, 0, 2, 123, 125, 2, 0, 0, 0, 2, 123, 125]),
          {
            headers: { 'Content-Type': 'application/connect+json' },
          }
        )
      })
      const sandbox = await Sandbox.connect('offline-sandbox', { debug: true })
      const input = sandbox[channel].streamInput(42)
      const bytes = make()
      await input.send(bytes)
      if (bytes instanceof Uint8Array) bytes.fill(120)
      release()
      await input.close()
      expect(received).toEqual([expected])
    }
  )
}
