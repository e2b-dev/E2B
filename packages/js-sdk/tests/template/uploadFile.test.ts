import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { writeFile, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createServer, type IncomingMessage, type Server } from 'http'
import { AddressInfo } from 'net'
import { uploadFile } from '../../src/template/buildApi'

// Regression test for e2b-dev/e2b#1243 — uploadFile used to pass a Node
// Readable directly to fetch, which made undici fall back to
// Transfer-Encoding: chunked. S3 presigned PUT URLs reject that with 501
// NotImplemented. The fix buffers the archive first so Content-Length is set.
describe('uploadFile transfer encoding', () => {
  let testDir: string
  let server: Server
  let baseUrl: string
  let capturedHeaders: IncomingMessage['headers'] = {}
  let capturedBodyLength = 0

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'uploadFile-test-'))
    await writeFile(join(testDir, 'hello.txt'), 'hello world')

    server = createServer((req, res) => {
      capturedHeaders = req.headers
      let bytes = 0
      req.on('data', (chunk: Buffer) => {
        bytes += chunk.length
      })
      req.on('end', () => {
        capturedBodyLength = bytes
        res.writeHead(200)
        res.end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${port}/upload`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(testDir, { recursive: true, force: true })
  })

  test('sets Content-Length and does not use chunked transfer encoding', async () => {
    await uploadFile(
      {
        fileName: '*.txt',
        fileContextPath: testDir,
        url: baseUrl,
        ignorePatterns: [],
        resolveSymlinks: false,
      },
      undefined
    )

    expect(capturedHeaders['content-length']).toBeDefined()
    const contentLength = Number(capturedHeaders['content-length'])
    expect(contentLength).toBeGreaterThan(0)
    expect(contentLength).toBe(capturedBodyLength)

    const transferEncoding = capturedHeaders['transfer-encoding']
    if (transferEncoding !== undefined) {
      expect(transferEncoding.toLowerCase()).not.toContain('chunked')
    }
  })
})
