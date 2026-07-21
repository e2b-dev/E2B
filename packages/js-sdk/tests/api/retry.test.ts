import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    delete process.env.E2B_REQUEST_RETRIES
})

describe('withRetry', () => {
    test('returns response on success without retrying', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })))
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(200)
        expect(baseFetch).toHaveBeenCalledOnce()
    })

    test('retries on 502 and succeeds', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi
            .fn()
            .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }))
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(200)
        expect(baseFetch).toHaveBeenCalledTimes(2)
    })

    test('retries on 503 and succeeds', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi
            .fn()
            .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }))
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(200)
        expect(baseFetch).toHaveBeenCalledTimes(2)
    })

    test('retries on 504 and succeeds', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi
            .fn()
            .mockResolvedValueOnce(new Response('timeout', { status: 504 }))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }))
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(200)
        expect(baseFetch).toHaveBeenCalledTimes(2)
    })

    test('does not retry on 400', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn(() =>
            Promise.resolve(new Response('bad request', { status: 400 }))
        )
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(400)
        expect(baseFetch).toHaveBeenCalledOnce()
    })

    test('does not retry on 401', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn(() =>
            Promise.resolve(new Response('unauthorized', { status: 401 }))
        )
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(401)
        expect(baseFetch).toHaveBeenCalledOnce()
    })

    test('does not retry on 429', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn(() =>
            Promise.resolve(new Response('rate limited', { status: 429 }))
        )
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(429)
        expect(baseFetch).toHaveBeenCalledOnce()
    })

    test('retries on network error and succeeds', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi
            .fn()
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }))
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(200)
        expect(baseFetch).toHaveBeenCalledTimes(2)
    })

    test('does not retry on AbortError', async () => {
        const { withRetry } = await import('../../src/api/http2')
        const abortError = new DOMException('The operation was aborted', 'AbortError')
        const baseFetch = vi.fn().mockRejectedValue(abortError)
        const retryFetch = withRetry(baseFetch as typeof fetch)

        await expect(retryFetch('https://api.e2b.dev/test')).rejects.toThrow(
            'The operation was aborted'
        )
        expect(baseFetch).toHaveBeenCalledOnce()
    })

    test('exhausts retries on persistent network error', async () => {
        process.env.E2B_REQUEST_RETRIES = '2'
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
        const retryFetch = withRetry(baseFetch as typeof fetch)

        await expect(retryFetch('https://api.e2b.dev/test')).rejects.toThrow('fetch failed')
        // 1 initial + 2 retries = 3 total
        expect(baseFetch).toHaveBeenCalledTimes(3)
    })

    test('returns last retryable response when retries exhausted', async () => {
        process.env.E2B_REQUEST_RETRIES = '2'
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn(() =>
            Promise.resolve(new Response('bad gateway', { status: 502 }))
        )
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(502)
        // 1 initial + 2 retries = 3 total
        expect(baseFetch).toHaveBeenCalledTimes(3)
    })

    test('disables retry when E2B_REQUEST_RETRIES=0', async () => {
        process.env.E2B_REQUEST_RETRIES = '0'
        const { withRetry } = await import('../../src/api/http2')
        const baseFetch = vi.fn(() =>
            Promise.resolve(new Response('bad gateway', { status: 502 }))
        )
        const retryFetch = withRetry(baseFetch as typeof fetch)

        const response = await retryFetch('https://api.e2b.dev/test')

        expect(response.status).toBe(502)
        expect(baseFetch).toHaveBeenCalledOnce()
    })
})
