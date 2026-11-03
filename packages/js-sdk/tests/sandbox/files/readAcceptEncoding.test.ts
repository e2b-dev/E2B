import { expect, test, vi } from 'vitest'

import { ConnectionConfig } from '../../../src/connectionConfig'
import { EnvdApiClient } from '../../../src/envd/api'
import { Filesystem } from '../../../src/sandbox/filesystem'

const formats = ['text', 'bytes', 'blob', 'stream'] as const

function filesystem(seen: (string | null)[]) {
  const fetchImpl = vi.fn(async (request: Request) => {
    seen.push(request.headers.get('Accept-Encoding'))
    return new Response('hello', { status: 200 })
  }) as unknown as typeof fetch
  const envdApi = new EnvdApiClient(
    { apiUrl: 'https://envd.e2b.test', logger: undefined, fetch: fetchImpl },
    { version: '0.6.0' }
  )
  return new Filesystem(
    {} as never,
    envdApi,
    new ConnectionConfig({ apiKey: 'e2b_test' })
  )
}

test.each(
  formats.flatMap((format) => [
    { format, gzip: undefined, expected: 'identity' },
    { format, gzip: false, expected: 'identity' },
    { format, gzip: true, expected: 'gzip' },
  ])
)(
  'read format=$format gzip=$gzip sends Accept-Encoding: $expected',
  async ({ format, gzip, expected }) => {
    const seen: (string | null)[] = []
    const result = await filesystem(seen).read('/file', { format, gzip })
    if (format === 'stream') {
      await new Response(result as ReadableStream).arrayBuffer()
    }
    expect(seen).toEqual([expected])
  }
)
