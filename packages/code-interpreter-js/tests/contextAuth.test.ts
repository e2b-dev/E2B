import { afterEach, expect, test, vi } from 'vitest'

import { Sandbox } from '../src'

afterEach(() => vi.unstubAllGlobals())

test.each(['sandbox-token', undefined])(
  'context operations forward the sandbox token (%s)',
  async (envdAccessToken) => {
    const context = { id: 'context-id', language: 'python', cwd: '/home/user' }
    const requests: Request[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const request = new Request(url, init)
      requests.push(request)
      if (request.headers.get('X-Access-Token') !== (envdAccessToken ?? null)) {
        return new Response('Unauthorized', { status: 401 })
      }
      return Response.json(request.method === 'GET' ? [context] : context)
    })
    const SandboxClass = Sandbox as unknown as new (opts: object) => Sandbox
    const sandbox = new SandboxClass({
      sandboxId: 'sandbox-id',
      envdVersion: '0.2.0',
      envdAccessToken,
      trafficAccessToken: 'traffic-token',
      sandboxUrl: 'https://interpreter.example.test',
    })

    expect(await sandbox.createCodeContext()).toEqual(context)
    expect(await sandbox.listCodeContexts()).toEqual([context])
    await sandbox.restartCodeContext(context)
    await sandbox.removeCodeContext(context)

    expect(requests).toHaveLength(4)
    for (const request of requests) {
      expect(request.headers.get('X-Access-Token')).toBe(
        envdAccessToken ?? null
      )
      expect(request.headers.get('E2B-Traffic-Access-Token')).toBe(
        'traffic-token'
      )
      expect(request.headers.get('E2b-Sandbox-Id')).toBe('sandbox-id')
      expect(request.headers.get('E2b-Sandbox-Port')).toBe('49999')
    }
  }
)
