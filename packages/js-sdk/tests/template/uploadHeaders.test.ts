import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createServer, type IncomingMessage, type Server } from 'http'
import { AddressInfo } from 'net'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { randomUUID } from 'node:crypto'

import { Template } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

// The file-upload-link response carries headers the signed URL cannot carry
// itself (Azure's Put Blob requires x-ms-blob-type); without them every
// uncached COPY fails with a storage 400 on an Azure-backed cluster.

let testDir: string
let uploadServer: Server
let uploadUrl: string
let capturedHeaders: IncomingMessage['headers'] = {}

let linkHeaders: Record<string, string> | undefined

const restHandlers = [
  http.post(apiUrl('/v3/templates'), async ({ request }) => {
    const { name } = (await request.clone().json()) as { name: string }
    return HttpResponse.json({
      buildID: randomUUID(),
      templateID: name,
      tags: [],
    })
  }),
  http.get(apiUrl('/templates/:templateID/files/:hash'), () =>
    HttpResponse.json({
      present: false,
      url: uploadUrl,
      headers: linkHeaders,
    })
  ),
  http.post(apiUrl('/v2/templates/:templateID/builds/:buildID'), () =>
    HttpResponse.json({})
  ),
]

const server = setupServer(...restHandlers)

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'uploadHeaders-test-'))
  await writeFile(join(testDir, 'hello.txt'), 'hello world')

  uploadServer = createServer((req, res) => {
    capturedHeaders = req.headers
    req.on('data', () => {})
    req.on('end', () => {
      res.writeHead(200)
      res.end()
    })
  })
  await new Promise<void>((resolve) =>
    uploadServer.listen(0, '127.0.0.1', resolve)
  )
  const { port } = uploadServer.address() as AddressInfo
  uploadUrl = `http://127.0.0.1:${port}/upload`

  // Only the local upload server may go unmocked. print.error() alone still
  // performs the request, so anything else is blocked by throwing.
  server.listen({
    onUnhandledRequest: (request, print) => {
      if (new URL(request.url).hostname === '127.0.0.1') return
      print.error()
      throw new Error(`unhandled request: ${request.method} ${request.url}`)
    },
  })
})

afterAll(async () => {
  server.close()
  await new Promise<void>((resolve) => uploadServer.close(() => resolve()))
  await rm(testDir, { recursive: true, force: true })
})

afterEach(() => {
  capturedHeaders = {}
  linkHeaders = undefined
})

test('upload PUT carries the headers the upload link returned', async () => {
  linkHeaders = { 'x-ms-blob-type': 'BlockBlob' }

  const template = Template({ fileContextPath: testDir })
    .fromBaseImage()
    .copy('*.txt', '.')

  await Template.buildInBackground(template, 'upload-headers', {
    apiKey: TEST_API_KEY,
  })

  expect(capturedHeaders['x-ms-blob-type']).toBe('BlockBlob')
  expect(Number(capturedHeaders['content-length'])).toBeGreaterThan(0)
  expect(
    (capturedHeaders['transfer-encoding'] ?? '').toLowerCase()
  ).not.toContain('chunked')
  expect(capturedHeaders['content-type']).toBeUndefined()
})

test('upload PUT is unchanged when the upload link returns no headers', async () => {
  const template = Template({ fileContextPath: testDir })
    .fromBaseImage()
    .copy('*.txt', '.')

  await Template.buildInBackground(template, 'upload-no-headers', {
    apiKey: TEST_API_KEY,
  })

  expect(capturedHeaders['x-ms-blob-type']).toBeUndefined()
  expect(Number(capturedHeaders['content-length'])).toBeGreaterThan(0)
})
