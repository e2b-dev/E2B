import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../../src'
import { InvalidArgumentError } from '../../../src/errors'
import { TEST_API_KEY, apiUrl } from '../../setup'
import { setupMockApi } from '../../mockApi'

// Arguments envd would act on as something else: an empty path is the user's
// home directory, and data of another type is uploaded as its text. Each must
// be refused before a request is sent.

const requests: string[] = []

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), () =>
    HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.6.11',
      envdAccessToken: 'test-envd-access-token',
    })
  )
)

let sandbox: Sandbox

beforeAll(async () => {
  await server.listen({ onUnhandledRequest: 'error' })
  sandbox = await Sandbox.create('base', { apiKey: TEST_API_KEY })
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${request.url}`)
  })
})

afterAll(() => server.close())

afterEach(() => {
  requests.length = 0
})

const untyped = (value: unknown) => value as any

describe('paths that must name something', () => {
  test.each([[''], [undefined], [null]])(
    'files.remove refuses %j',
    async (path) => {
      await expect(sandbox.files.remove(untyped(path))).rejects.toThrow(
        InvalidArgumentError
      )
      expect(requests).toEqual([])
    }
  )

  test.each([
    ['source', '', 'new.txt'],
    ['destination', 'old.txt', ''],
  ])('files.rename refuses an empty %s', async (_, oldPath, newPath) => {
    await expect(sandbox.files.rename(oldPath, newPath)).rejects.toThrow(
      InvalidArgumentError
    )
    expect(requests).toEqual([])
  })
})

describe('upload data', () => {
  test.each([[undefined], [null], [42], [{ text: 'hello' }], [['a', 'b']]])(
    'files.write refuses %j as data',
    async (data) => {
      await expect(
        sandbox.files.write('file.txt', untyped(data))
      ).rejects.toThrow(InvalidArgumentError)
      expect(requests).toEqual([])
    }
  )

  test.each(['write', 'writeFiles'] as const)(
    'files.%s refuses an entry without a path',
    async (method) => {
      await expect(
        sandbox.files[method]([untyped({ data: 'hello' })])
      ).rejects.toThrow(InvalidArgumentError)
      expect(requests).toEqual([])
    }
  )
})

describe('signature expiration', () => {
  describe.each(['downloadUrl', 'uploadUrl'] as const)('%s', (method) => {
    test.each([['60'], [1.5], [NaN], [Infinity]])(
      'refuses %j',
      async (useSignatureExpiration) => {
        await expect(
          sandbox[method]('file.txt', {
            useSignatureExpiration: untyped(useSignatureExpiration),
          })
        ).rejects.toThrow(InvalidArgumentError)
      }
    )
  })

  test('a whole number of seconds is added to the current time', async () => {
    const before = Math.floor(Date.now() / 1000)

    const url = new URL(
      await sandbox.downloadUrl('file.txt', { useSignatureExpiration: 60 })
    )

    const expiration = Number(url.searchParams.get('signature_expiration'))
    expect(expiration).toBeGreaterThanOrEqual(before + 60)
    expect(expiration).toBeLessThanOrEqual(before + 62)
  })
})
