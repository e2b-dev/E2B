import { describe, it, expect, afterAll, afterEach, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { randomUUID } from 'node:crypto'

import { Volume, NotFoundError } from '../../src'
import { VolumeConnectionConfig } from '../../src/volume/client'
import { apiUrl } from '../setup'

// In-memory store for mock volumes
const volumes = new Map<
  string,
  { volumeID: string; name: string; token: string }
>()

// In-memory store for mock volume file contents, keyed by path
const volumeFiles = new Map<string, string>()

const restHandlers = [
  // POST /volumes - create (returns VolumeAndToken)
  http.post(apiUrl('/volumes'), async ({ request }) => {
    const { name } = (await request.clone().json()) as { name: string }
    const volumeID = randomUUID()
    const token = `vol-token-${randomUUID()}`
    volumes.set(volumeID, { volumeID, name, token })
    return HttpResponse.json({ volumeID, name, token }, { status: 201 })
  }),

  // GET /volumes - list (returns Volume[] without tokens)
  http.get(apiUrl('/volumes'), () => {
    const list = Array.from(volumes.values()).map(({ volumeID, name }) => ({
      volumeID,
      name,
    }))
    return HttpResponse.json(list)
  }),

  // GET /volumes/:volumeID - get info (returns VolumeAndToken with token)
  http.get<{ volumeID: string }>(apiUrl('/volumes/:volumeID'), ({ params }) => {
    const vol = volumes.get(params.volumeID)
    if (!vol) {
      return HttpResponse.json(
        { code: 404, message: 'Not found' },
        { status: 404 }
      )
    }
    return HttpResponse.json(vol)
  }),

  // DELETE /volumes/:volumeID - destroy
  http.delete<{ volumeID: string }>(
    apiUrl('/volumes/:volumeID'),
    ({ params }) => {
      const existed = volumes.delete(params.volumeID)
      if (!existed) {
        return HttpResponse.json(
          { code: 404, message: 'Not found' },
          { status: 404 }
        )
      }
      return new HttpResponse(null, { status: 204 })
    }
  ),

  // GET /volumecontent/:volumeID/file - read file content
  http.get(apiUrl('/volumecontent/:volumeID/file'), ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? ''
    const content = volumeFiles.get(path)
    if (content === undefined) {
      return HttpResponse.json(
        { code: 404, message: 'Not found' },
        { status: 404 }
      )
    }
    return new HttpResponse(content.length > 0 ? content : null, {
      status: 200,
      headers: { 'Content-Length': String(content.length) },
    })
  }),
]

const server = setupServer(...restHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  volumes.clear()
  volumeFiles.clear()
})

describe('Volume CRUD', () => {
  it('should create a volume', async () => {
    const vol = await Volume.create('test-volume')

    expect(vol).toBeDefined()
    expect(vol.volumeId).toBeDefined()
    expect(vol.name).toBe('test-volume')
    expect(vol.token).toBeDefined()
    expect(vol.token).not.toBe('undefined')
  })

  it('should get volume info', async () => {
    const created = await Volume.create('info-volume')
    const info = await Volume.getInfo(created.volumeId)

    expect(info.volumeId).toBe(created.volumeId)
    expect(info.name).toBe('info-volume')
  })

  it('should list volumes', async () => {
    await Volume.create('vol-a')
    await Volume.create('vol-b')

    const list = await Volume.list()

    expect(list).toHaveLength(2)
    expect(list.map((v) => v.name).sort()).toEqual(['vol-a', 'vol-b'])
  })

  it('should return empty list when no volumes exist', async () => {
    const list = await Volume.list()
    expect(list).toHaveLength(0)
  })

  it('should destroy a volume', async () => {
    const vol = await Volume.create('to-delete')
    const result = await Volume.destroy(vol.volumeId)

    expect(result).toBe(true)

    // Verify it's gone
    const list = await Volume.list()
    expect(list).toHaveLength(0)
  })

  it('should return false when destroying a non-existent volume', async () => {
    const result = await Volume.destroy('non-existent-id')
    expect(result).toBe(false)
  })

  it('should throw NotFoundError when getting info of non-existent volume', async () => {
    await expect(Volume.getInfo('non-existent-id')).rejects.toThrow(
      NotFoundError
    )
  })

  it('should keep the proxy on the instance so content calls reuse it', async () => {
    const proxy = 'http://user:pass@127.0.0.1:8080'
    const vol = await Volume.create('proxy-volume', { proxy })

    // The proxy is stored on the instance...
    expect(vol.proxy).toBe(proxy)

    // ...and instance methods (which build a VolumeConnectionConfig with no
    // per-call proxy) pick it up rather than falling back to no proxy.
    const config = new VolumeConnectionConfig(vol)
    expect(config.proxy).toBe(proxy)
  })

  it('should let a per-call proxy override the instance proxy', async () => {
    const vol = await Volume.create('proxy-volume', {
      proxy: 'http://127.0.0.1:8080',
    })

    const config = new VolumeConnectionConfig(vol, {
      proxy: 'http://127.0.0.1:9090',
    })
    expect(config.proxy).toBe('http://127.0.0.1:9090')
  })

  it('should handle full lifecycle: create, get, list, destroy', async () => {
    // Create
    const vol = await Volume.create('lifecycle-vol')
    expect(vol.name).toBe('lifecycle-vol')

    // Get info
    const info = await Volume.getInfo(vol.volumeId)
    expect(info.name).toBe('lifecycle-vol')

    // List - should contain the volume
    const list = await Volume.list()
    expect(list).toHaveLength(1)
    expect(list[0].volumeId).toBe(vol.volumeId)

    // Destroy
    const destroyed = await Volume.destroy(vol.volumeId)
    expect(destroyed).toBe(true)

    // List again - should be empty
    const listAfter = await Volume.list()
    expect(listAfter).toHaveLength(0)
  })
})

describe('Volume content readFile', () => {
  it('should return content for a non-empty file in every format', async () => {
    volumeFiles.set('hello.txt', 'hello world')
    const vol = await Volume.create('content-volume')

    const text = await vol.readFile('hello.txt')
    expect(text).toBe('hello world')

    const bytes = await vol.readFile('hello.txt', { format: 'bytes' })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(bytes)).toBe('hello world')

    const blob = await vol.readFile('hello.txt', { format: 'blob' })
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe('hello world')

    const stream = await vol.readFile('hello.txt', { format: 'stream' })
    expect(stream).toBeInstanceOf(ReadableStream)
    expect(await new Response(stream).text()).toBe('hello world')
  })

  it('should return empty values for an empty file in every format', async () => {
    volumeFiles.set('empty.txt', '')
    const vol = await Volume.create('content-volume')

    const text = await vol.readFile('empty.txt')
    expect(text).toBe('')

    const bytes = await vol.readFile('empty.txt', { format: 'bytes' })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(0)

    const blob = await vol.readFile('empty.txt', { format: 'blob' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBe(0)

    const stream = await vol.readFile('empty.txt', { format: 'stream' })
    expect(stream).toBeInstanceOf(ReadableStream)
    expect(await new Response(stream).text()).toBe('')
  })

  it('should throw NotFoundError for a missing file', async () => {
    const vol = await Volume.create('content-volume')

    await expect(vol.readFile('missing.txt')).rejects.toThrow(NotFoundError)
  })

  it('should reject at call time for a missing file with stream format', async () => {
    const vol = await Volume.create('content-volume')

    await expect(
      vol.readFile('missing.txt', { format: 'stream' })
    ).rejects.toThrow(NotFoundError)
  })
})

describe('VolumeConnectionConfig request timeout', () => {
  it('should default the request timeout to 60 seconds', async () => {
    const vol = await Volume.create('timeout-volume')

    const config = new VolumeConnectionConfig(vol)
    expect(config.requestTimeoutMs).toBe(60_000)
    expect(config.getSignal()).toBeInstanceOf(AbortSignal)
  })

  it('should let a per-call timeout override the default', async () => {
    const vol = await Volume.create('timeout-volume')

    const config = new VolumeConnectionConfig(vol, { requestTimeoutMs: 1_000 })
    expect(config.requestTimeoutMs).toBe(1_000)
  })

  it('should disable the timeout when requestTimeoutMs is 0', async () => {
    const vol = await Volume.create('timeout-volume')

    const config = new VolumeConnectionConfig(vol, { requestTimeoutMs: 0 })
    expect(config.requestTimeoutMs).toBe(0)
    expect(config.getSignal()).toBeUndefined()
  })
})
