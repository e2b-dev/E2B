import { afterAll, afterEach, assert, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { ConnectionConfig, Sandbox } from '../../src'
import { TemplateError } from '../../src/errors'
import { TEST_API_KEY } from '../setup'

const sandboxId = 'sbx-upload-mode'
const envdUrl = `https://49983-${sandboxId}.sandbox.e2b.dev`

interface CapturedUpload {
  contentType: string | null
  contentEncoding: string | null
  metadataHeaders: Record<string, string>
  body: string
}

let uploads: CapturedUpload[] = []

const server = setupServer(
  http.post(`${envdUrl}/files`, async ({ request }) => {
    const metadataHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-metadata-')) {
        metadataHeaders[key.toLowerCase()] = value
      }
    })
    uploads.push({
      contentType: request.headers.get('content-type'),
      contentEncoding: request.headers.get('content-encoding'),
      metadataHeaders,
      body: await request.text(),
    })
    return HttpResponse.json([
      { name: 'hello.txt', type: 'file', path: '/home/user/hello.txt' },
    ])
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  uploads = []
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

test('uploads as multipart by default', async () => {
  await sandbox().files.write('/home/user/hello.txt', 'hello world')

  assert.include(uploads[0].contentType ?? '', 'multipart/form-data')
})

test('uploads as octet-stream when asked', async () => {
  await sandbox().files.write('/home/user/hello.txt', 'hello world', {
    useOctetStream: true,
  })

  assert.equal(uploads[0].contentType, 'application/octet-stream')
  assert.equal(uploads[0].body, 'hello world')
})

test('falls back to multipart below ENVD_OCTET_STREAM_UPLOAD', async () => {
  await sandbox('0.5.6').files.write('/home/user/hello.txt', 'hello world', {
    useOctetStream: true,
  })

  assert.include(uploads[0].contentType ?? '', 'multipart/form-data')
})

test('a stream body implies octet-stream', async () => {
  const data = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('streamed'))
      controller.close()
    },
  })

  await sandbox().files.write('/home/user/hello.txt', data)

  assert.equal(uploads[0].contentType, 'application/octet-stream')
  assert.equal(uploads[0].body, 'streamed')
})

test('gzip implies octet-stream and sets Content-Encoding', async () => {
  await sandbox().files.write('/home/user/hello.txt', 'hello world', {
    gzip: true,
  })

  assert.equal(uploads[0].contentType, 'application/octet-stream')
  assert.equal(uploads[0].contentEncoding, 'gzip')
})

test('sends metadata as request headers', async () => {
  await sandbox().files.write('/home/user/hello.txt', 'hello world', {
    metadata: { origin: 'unit-test' },
  })

  assert.equal(uploads[0].metadataHeaders['x-metadata-origin'], 'unit-test')
})

test('rejects metadata below ENVD_FILE_METADATA', async () => {
  await expect(
    sandbox('0.6.1').files.write('/home/user/hello.txt', 'hello world', {
      metadata: { origin: 'unit-test' },
    })
  ).rejects.toThrowError(TemplateError)
  assert.lengthOf(uploads, 0)
})

test('uploads every entry of a multi-file octet-stream write', async () => {
  await sandbox().files.write(
    [
      { path: '/home/user/a.txt', data: 'a' },
      { path: '/home/user/b.txt', data: 'b' },
    ],
    { useOctetStream: true }
  )

  assert.lengthOf(uploads, 2)
  assert.deepEqual(uploads.map((upload) => upload.body).sort(), ['a', 'b'])
})

test('sends a single multipart request for a multi-file write', async () => {
  await sandbox().files.write([
    { path: '/home/user/a.txt', data: 'a' },
    { path: '/home/user/b.txt', data: 'b' },
  ])

  assert.lengthOf(uploads, 1)
  assert.include(uploads[0].contentType ?? '', 'multipart/form-data')
})
