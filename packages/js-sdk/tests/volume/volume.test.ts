import { describe, it, expect, afterAll, afterEach, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { randomUUID } from 'node:crypto'

import { VolumeBase, NotFoundError } from '../../src'
import { apiUrl } from '../setup'

// In-memory store for mock volumes
const volumes = new Map<string, { id: string; name: string }>()

const restHandlers = [
  // POST /volumes - create
  http.post(apiUrl('/volumes'), async ({ request }) => {
    const { name } = (await request.clone().json()) as { name: string }
    const id = randomUUID()
    const vol = { id, name }
    volumes.set(id, vol)
    return HttpResponse.json(vol, { status: 201 })
  }),

  // GET /volumes - list
  http.get(apiUrl('/volumes'), () => {
    return HttpResponse.json(Array.from(volumes.values()))
  }),

  // GET /volumes/:volumeID - get info
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
]

const server = setupServer(...restHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  volumes.clear()
})

describe('Volume CRUD', () => {
  it('should create a volume', async () => {
    const vol = await VolumeBase.create('test-volume')

    expect(vol).toBeDefined()
    expect(vol.volumeId).toBeDefined()
    expect(vol.name).toBe('test-volume')
  })

  it('should get volume info', async () => {
    const created = await VolumeBase.create('info-volume')
    const info = await VolumeBase.getInfo(created.volumeId)

    expect(info.volumeId).toBe(created.volumeId)
    expect(info.name).toBe('info-volume')
  })

  it('should list volumes', async () => {
    await VolumeBase.create('vol-a')
    await VolumeBase.create('vol-b')

    const list = await VolumeBase.list()

    expect(list).toHaveLength(2)
    expect(list.map((v) => v.name).sort()).toEqual(['vol-a', 'vol-b'])
  })

  it('should return empty list when no volumes exist', async () => {
    const list = await VolumeBase.list()
    expect(list).toHaveLength(0)
  })

  it('should destroy a volume', async () => {
    const vol = await VolumeBase.create('to-delete')
    const result = await VolumeBase.destroy(vol.volumeId)

    expect(result).toBe(true)

    // Verify it's gone
    const list = await VolumeBase.list()
    expect(list).toHaveLength(0)
  })

  it('should return false when destroying a non-existent volume', async () => {
    const result = await VolumeBase.destroy('non-existent-id')
    expect(result).toBe(false)
  })

  it('should throw NotFoundError when getting info of non-existent volume', async () => {
    await expect(VolumeBase.getInfo('non-existent-id')).rejects.toThrow(
      NotFoundError
    )
  })

  it('should handle full lifecycle: create, get, list, destroy', async () => {
    // Create
    const vol = await VolumeBase.create('lifecycle-vol')
    expect(vol.name).toBe('lifecycle-vol')

    // Get info
    const info = await VolumeBase.getInfo(vol.volumeId)
    expect(info.name).toBe('lifecycle-vol')

    // List - should contain the volume
    const list = await VolumeBase.list()
    expect(list).toHaveLength(1)
    expect(list[0].volumeId).toBe(vol.volumeId)

    // Destroy
    const destroyed = await VolumeBase.destroy(vol.volumeId)
    expect(destroyed).toBe(true)

    // List again - should be empty
    const listAfter = await VolumeBase.list()
    expect(listAfter).toHaveLength(0)
  })
})
