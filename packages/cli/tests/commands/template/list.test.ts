import { describe, expect, test } from 'vitest'
import { ApiClient, ConnectionConfig } from 'e2b'
import { getUserConfig } from 'src/user'
import { isDebug, runCli } from '../../setup'

const userConfig = getUserConfig()
const apiKey = process.env.E2B_API_KEY || userConfig?.projectApiKey
const domain = process.env.E2B_DOMAIN || 'e2b.app'
const integrationTest = test.skipIf(!apiKey || isDebug)
const timeoutMs = 120_000

describe('template list', () => {
  integrationTest(
    'returns every page of the team templates',
    async () => {
      const client = new ApiClient(new ConnectionConfig({ apiKey, domain }))
      const firstPage = await client.api.GET('/v2/templates')
      expect(firstPage.error).toBeUndefined()

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        E2B_API_KEY: apiKey,
        E2B_DOMAIN: domain,
      }
      delete env.E2B_DEBUG
      const result = runCli(['template', 'list', '-f', 'json'], {
        timeoutMs,
        env,
      })
      expect(result.error).toBeUndefined()
      expect(result.status, String(result.stderr)).toBe(0)

      const templates: { templateID: string }[] = JSON.parse(
        String(result.stdout)
      )
      const ids = templates.map((t) => t.templateID)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toEqual(
        expect.arrayContaining(
          firstPage.data!.map((t: { templateID: string }) => t.templateID)
        )
      )
      if (firstPage.response.headers.get('x-next-token')) {
        expect(ids.length).toBeGreaterThan(firstPage.data!.length)
      }
    },
    timeoutMs
  )
})
