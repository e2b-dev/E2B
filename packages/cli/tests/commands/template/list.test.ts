import { beforeAll, describe, expect, test } from 'vitest'
import { ApiClient, ConnectionConfig } from 'e2b'
import { getUserConfig } from 'src/user'
import { isDebug, runCli } from '../../setup'

const userConfig = getUserConfig()
const apiKey = process.env.E2B_API_KEY || userConfig?.projectApiKey
const domain = process.env.E2B_DOMAIN || 'e2b.app'
const shouldSkip = !apiKey || isDebug
const integrationTest = test.skipIf(shouldSkip)
const timeoutMs = 120_000

const env: NodeJS.ProcessEnv = {
  ...process.env,
  E2B_API_KEY: apiKey,
  E2B_DOMAIN: domain,
}
delete env.E2B_DEBUG

function listTemplates(args: string[]) {
  const result = runCli(['template', 'list', ...args], { timeoutMs, env })
  expect(result.error).toBeUndefined()
  expect(result.status, String(result.stderr)).toBe(0)
  return String(result.stdout)
}

function listTemplateIds(args: string[]): string[] {
  const templates: { templateID: string }[] = JSON.parse(
    listTemplates([...args, '-f', 'json'])
  )
  return templates.map((t) => t.templateID)
}

describe('template list', () => {
  let firstPageIds: string[] = []
  let hasSecondPage = false

  beforeAll(async () => {
    if (shouldSkip) return

    const client = new ApiClient(new ConnectionConfig({ apiKey, domain }))
    const res = await client.api.GET('/v2/templates')
    expect(res.response.ok, res.response.statusText).toBe(true)
    firstPageIds = res.data!.map((t: { templateID: string }) => t.templateID)
    hasSecondPage = !!res.response.headers.get('x-next-token')
  })

  integrationTest(
    'stops at --limit across pages',
    () => {
      if (!hasSecondPage) return
      const limit = firstPageIds.length + 1

      const ids = listTemplateIds(['--limit', String(limit)])

      expect(ids).toHaveLength(limit)
      expect(new Set(ids).size).toBe(limit)
      expect(ids).toEqual(expect.arrayContaining(firstPageIds))
    },
    timeoutMs
  )

  integrationTest(
    'hints at --limit when more templates exist',
    () => {
      if (firstPageIds.length < 2) return

      expect(listTemplates(['--limit', '1'])).toContain(
        'Showing first 1 templates. Use --limit to change.'
      )
    },
    timeoutMs
  )
})
