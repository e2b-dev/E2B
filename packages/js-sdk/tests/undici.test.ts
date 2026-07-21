import { describe, expect, test, vi } from 'vitest'

import {
  getUndiciPackageCandidates,
  retryGracefulHttp2GoAway,
} from '../src/undici'

function goAway(code = 0): Error {
  return Object.assign(
    new Error(`HTTP/2: "GOAWAY" frame received with code ${code}`),
    { code: 'UND_ERR_SOCKET' }
  )
}

function wrappedGoAway(code = 0): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: goAway(code) })
}

describe('getUndiciPackageCandidates', () => {
  test.each(['20.20.2', '22.0.0', '22.18.0'])(
    'uses Undici 7 on Node %s',
    (nodeVersion) => {
      expect(getUndiciPackageCandidates(nodeVersion)).toEqual(['undici'])
    }
  )

  test.each(['22.19.0', '22.23.1', '24.0.0', '26.0.0'])(
    'prefers Undici 8 on Node %s with a version 7 fallback',
    (nodeVersion) => {
      expect(getUndiciPackageCandidates(nodeVersion)).toEqual([
        'undici8',
        'undici',
      ])
    }
  )
})

describe('retryGracefulHttp2GoAway', () => {
  test.each(['GET', 'HEAD'])(
    'retries one graceful GOAWAY for %s',
    async (method) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(wrappedGoAway())
        .mockResolvedValueOnce(new Response('ok'))

      const response = await retryGracefulHttp2GoAway(fetcher)(
        'https://example.com/resource',
        { method }
      )

      expect(await response.text()).toBe('ok')
      expect(fetcher).toHaveBeenCalledTimes(2)
    }
  )

  test('surfaces a second graceful GOAWAY without another retry', async () => {
    const secondError = wrappedGoAway()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(wrappedGoAway())
      .mockRejectedValueOnce(secondError)

    await expect(
      retryGracefulHttp2GoAway(fetcher)('https://example.com/resource')
    ).rejects.toBe(secondError)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test.each([
    ['a nonzero GOAWAY', wrappedGoAway(1)],
    [
      'a generic socket error',
      Object.assign(new Error('other side closed'), {
        code: 'UND_ERR_SOCKET',
      }),
    ],
  ])('does not retry %s', async (_name, error) => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error)

    await expect(
      retryGracefulHttp2GoAway(fetcher)('https://example.com/resource')
    ).rejects.toBe(error)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test.each(['POST', 'PUT', 'DELETE'])(
    'does not retry a graceful GOAWAY for %s',
    async (method) => {
      const error = wrappedGoAway()
      const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error)

      await expect(
        retryGracefulHttp2GoAway(fetcher)('https://example.com/resource', {
          method,
        })
      ).rejects.toBe(error)
      expect(fetcher).toHaveBeenCalledOnce()
    }
  )

  test('uses the Request method when init does not override it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(goAway())
      .mockResolvedValueOnce(new Response('ok'))
    const request = new Request('https://example.com/resource', {
      method: 'HEAD',
    })

    await retryGracefulHttp2GoAway(fetcher)(request)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('uses an init method override instead of the Request method', async () => {
    const error = goAway()
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error)
    const request = new Request('https://example.com/resource')

    await expect(
      retryGracefulHttp2GoAway(fetcher)(request, { method: 'DELETE' })
    ).rejects.toBe(error)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test('retries when an init override changes the Request method to GET', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(goAway())
      .mockResolvedValueOnce(new Response('ok'))
    const request = new Request('https://example.com/resource', {
      method: 'DELETE',
    })

    await retryGracefulHttp2GoAway(fetcher)(request, { method: 'GET' })

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('does not retry when the request is aborted before replay', async () => {
    const controller = new AbortController()
    const abortReason = new Error('cancelled')
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
      controller.abort(abortReason)
      throw wrappedGoAway()
    })

    await expect(
      retryGracefulHttp2GoAway(fetcher)('https://example.com/resource', {
        signal: controller.signal,
      })
    ).rejects.toBe(abortReason)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  test('honors an explicit null signal override', async () => {
    const controller = new AbortController()
    controller.abort()
    const request = new Request('https://example.com/resource', {
      signal: controller.signal,
    })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(wrappedGoAway())
      .mockResolvedValueOnce(new Response('ok'))

    await retryGracefulHttp2GoAway(fetcher)(request, { signal: null })

    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
