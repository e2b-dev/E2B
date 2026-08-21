import { describe, it, expect, afterAll, afterEach, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { randomUUID } from 'node:crypto'

import { InvalidArgumentError, Secret, SecretNotFoundError } from '../../src'
import { apiUrl } from '../setup'

interface MockSecret {
  secretID: string
  name: string
  currentVersion: number
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
}

// In-memory store for mock secrets, keyed by both ID and name
const secrets = new Map<string, MockSecret>()

function findSecret(selector: string): MockSecret | undefined {
  return (
    secrets.get(selector) ??
    Array.from(secrets.values()).find((s) => s.name === selector)
  )
}

const restHandlers = [
  http.post(apiUrl('/secrets'), async ({ request }) => {
    const { name, metadata } = (await request.clone().json()) as {
      name: string
      value: string
      metadata?: Record<string, string>
    }
    const now = new Date().toISOString()
    const secret: MockSecret = {
      secretID: `sec_${randomUUID()}`,
      name: name.toLowerCase(),
      currentVersion: 1,
      metadata: metadata ?? {},
      createdAt: now,
      updatedAt: now,
    }
    secrets.set(secret.secretID, secret)
    return HttpResponse.json(secret, { status: 201 })
  }),

  http.get(apiUrl('/secrets'), ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 100)
    const nextToken = url.searchParams.get('nextToken')

    const all = Array.from(secrets.values())
    const start = nextToken ? Number(nextToken) : 0
    const page = all.slice(start, start + limit)
    const headers: Record<string, string> = {}
    if (start + limit < all.length) {
      headers['x-next-token'] = String(start + limit)
    }
    return HttpResponse.json(page, { headers })
  }),

  http.get<{ secretID: string }>(apiUrl('/secrets/:secretID'), ({ params }) => {
    const secret = findSecret(params.secretID)
    if (!secret) {
      return HttpResponse.json(
        { code: 404, message: 'Not found' },
        { status: 404 }
      )
    }
    return HttpResponse.json(secret)
  }),

  http.post<{ secretID: string }>(
    apiUrl('/secrets/:secretID'),
    async ({ params, request }) => {
      const secret = findSecret(params.secretID)
      if (!secret) {
        return HttpResponse.json(
          { code: 404, message: 'Not found' },
          { status: 404 }
        )
      }
      const { metadata } = (await request.clone().json()) as {
        value: string
        metadata?: Record<string, string>
      }
      secret.currentVersion += 1
      if (metadata) {
        secret.metadata = metadata
      }
      secret.updatedAt = new Date().toISOString()
      return HttpResponse.json(secret)
    }
  ),

  http.delete<{ secretID: string }>(
    apiUrl('/secrets/:secretID'),
    ({ params }) => {
      const secret = findSecret(params.secretID)
      if (!secret) {
        return HttpResponse.json(
          { code: 404, message: 'Not found' },
          { status: 404 }
        )
      }
      secrets.delete(secret.secretID)
      return new HttpResponse(null, { status: 204 })
    }
  ),
]

const server = setupServer(...restHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  secrets.clear()
})

describe('Secret CRUD', () => {
  it('should create a secret', async () => {
    const info = await Secret.create('openai-api-key', 'sk-test', {
      metadata: { env: 'test' },
    })

    expect(info.secretId).toMatch(/^sec_/)
    expect(info.name).toBe('openai-api-key')
    expect(info.version).toBe(1)
    expect(info.metadata).toEqual({ env: 'test' })
    expect(info.createdAt).toBeInstanceOf(Date)
    expect(info.updatedAt).toBeInstanceOf(Date)
    expect(info).not.toHaveProperty('value')
  })

  it('should update a secret', async () => {
    const created = await Secret.create('rotating-key', 'v1')
    const updated = await Secret.update(created.secretId, 'v2')

    expect(updated.secretId).toBe(created.secretId)
    expect(updated.version).toBe(2)
  })

  it('should throw when updating a non-existent secret', async () => {
    await expect(Secret.update('missing', 'value')).rejects.toThrow(
      SecretNotFoundError
    )
  })

  it('should get secret info by ID and by name', async () => {
    const created = await Secret.create('lookup-key', 'value')

    const byId = await Secret.getInfo(created.secretId)
    expect(byId.name).toBe('lookup-key')

    const byName = await Secret.getInfo('lookup-key')
    expect(byName.secretId).toBe(created.secretId)
  })

  it('should throw when getting a non-existent secret', async () => {
    await expect(Secret.getInfo('missing')).rejects.toThrow(SecretNotFoundError)
  })

  // The 404 is thrown before handleApiError sees the response, so the trace ID
  // has to be read at the throw site
  it('should carry the trace ID on SecretNotFoundError', async () => {
    server.use(
      http.get(apiUrl('/secrets/:secretID'), () =>
        HttpResponse.json(
          { code: 404, message: 'Not found' },
          { status: 404, headers: { 'X-Trace-ID': 'abc123' } }
        )
      )
    )

    const err = await Secret.getInfo('missing').catch((err) => err)
    expect(err).toBeInstanceOf(SecretNotFoundError)
    expect(err.traceId).toBe('abc123')
    expect(err.message).toContain('(trace ID: abc123)')
  })

  it('should list secrets with pagination', async () => {
    await Secret.create('key-a', 'a')
    await Secret.create('key-b', 'b')
    await Secret.create('key-c', 'c')

    const paginator = Secret.list({ limit: 2 })
    const firstPage = await paginator.nextItems()
    expect(firstPage).toHaveLength(2)
    expect(paginator.hasNext).toBe(true)

    const secondPage = await paginator.nextItems()
    expect(secondPage).toHaveLength(1)
    expect(paginator.hasNext).toBe(false)
  })

  it('should check secret existence', async () => {
    await Secret.create('present-key', 'value')

    expect(await Secret.exists('present-key')).toBe(true)
    expect(await Secret.exists('absent-key')).toBe(false)
  })

  it('should destroy a secret', async () => {
    const created = await Secret.create('to-delete', 'value')

    expect(await Secret.destroy(created.secretId)).toBe(true)
    expect(await Secret.exists(created.secretId)).toBe(false)
  })

  it('should return false when destroying a non-existent secret', async () => {
    expect(await Secret.destroy('missing')).toBe(false)
  })
})

describe('Secret.fill', () => {
  it('should format a placeholder', () => {
    expect(Secret.fill('openai-api-key')).toBe('${e2b.secrets.openai-api-key}')
  })

  it.each(['', '{name', 'name}', 'name\n', 'name\x00'])(
    'should throw InvalidArgumentError for invalid name %j',
    (name) => {
      expect(() => Secret.fill(name)).toThrow(InvalidArgumentError)
    }
  )
})
