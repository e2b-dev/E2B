import { afterAll, afterEach, assert, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { ConnectionConfig, Sandbox } from '../../src'
import { NotFoundError } from '../../src/errors'
import { TEST_API_KEY } from '../setup'

const sandboxId = 'sbx-read-format'
const envdUrl = `https://49983-${sandboxId}.sandbox.e2b.dev`

let lastQuery: URLSearchParams | undefined

const server = setupServer(
  http.get(`${envdUrl}/files`, ({ request }) => {
    lastQuery = new URL(request.url).searchParams
    return HttpResponse.text('hello world')
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  lastQuery = undefined
  server.resetHandlers()
})

function sandbox(envdVersion = '0.6.4'): Sandbox {
  const config = new ConnectionConfig({ apiKey: TEST_API_KEY })
  return new Sandbox({
    ...config,
    sandboxId,
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion,
    envdAccessToken: 'token',
  })
}

test('reads text by default', async () => {
  const content = await sandbox().files.read('/home/user/hello.txt')

  assert.equal(content, 'hello world')
  assert.equal(lastQuery?.get('path'), '/home/user/hello.txt')
})

test('reads bytes as Uint8Array', async () => {
  const content = await sandbox().files.read('/home/user/hello.txt', {
    format: 'bytes',
  })

  assert.instanceOf(content, Uint8Array)
  assert.equal(new TextDecoder().decode(content), 'hello world')
})

test('reads a blob', async () => {
  const content = await sandbox().files.read('/home/user/hello.txt', {
    format: 'blob',
  })

  assert.instanceOf(content, Blob)
  assert.equal(await content.text(), 'hello world')
})

test('reads a stream', async () => {
  const content = await sandbox().files.read('/home/user/hello.txt', {
    format: 'stream',
  })

  assert.instanceOf(content, ReadableStream)

  const chunks: Uint8Array[] = []
  for await (const chunk of content as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  assert.equal(
    new TextDecoder().decode(
      new Uint8Array(chunks.flatMap((chunk) => Array.from(chunk)))
    ),
    'hello world'
  )
})

test('sends the default username below ENVD_DEFAULT_USER', async () => {
  await sandbox('0.3.9').files.read('/home/user/hello.txt')

  assert.equal(lastQuery?.get('username'), 'user')
})

test('omits the username on newer envd', async () => {
  await sandbox('0.4.0').files.read('/home/user/hello.txt')

  assert.equal(lastQuery?.get('username'), null)
})

test('requests gzip when asked', async () => {
  let acceptEncoding: string | null = null
  server.use(
    http.get(`${envdUrl}/files`, ({ request }) => {
      acceptEncoding = request.headers.get('accept-encoding')
      return HttpResponse.text('hello world')
    })
  )

  await sandbox().files.read('/home/user/hello.txt', { gzip: true })

  assert.equal(acceptEncoding, 'gzip')
})

test('returns an empty value per format for an empty file', async () => {
  server.use(
    http.get(`${envdUrl}/files`, () =>
      HttpResponse.text('', { headers: { 'content-length': '0' } })
    )
  )

  const files = sandbox().files
  assert.equal(await files.read('/home/user/empty.txt'), '')
  assert.deepEqual(
    await files.read('/home/user/empty.txt', { format: 'bytes' }),
    new Uint8Array(0)
  )
  assert.equal(
    await (await files.read('/home/user/empty.txt', { format: 'blob' })).text(),
    ''
  )
})

test('maps an envd 404 to NotFoundError for every format', async () => {
  server.use(
    http.get(`${envdUrl}/files`, () =>
      HttpResponse.json(
        { code: 404, message: 'file not found' },
        { status: 404 }
      )
    )
  )

  const files = sandbox().files
  await expect(files.read('/home/user/missing.txt')).rejects.toThrowError(
    NotFoundError
  )
  await expect(
    files.read('/home/user/missing.txt', { format: 'stream' })
  ).rejects.toThrowError(NotFoundError)
})
