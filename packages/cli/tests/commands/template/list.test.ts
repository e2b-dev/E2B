import { expect, test } from 'vitest'

import { bufferToText, isDebug, runCli } from '../../setup'

const apiKey = process.env.E2B_API_KEY
const domain = process.env.E2B_DOMAIN || 'e2b.app'
const shouldSkip = !apiKey || isDebug
const integrationTest = test.skipIf(shouldSkip)

const cliEnv: NodeJS.ProcessEnv = {
  ...process.env,
  E2B_DOMAIN: domain,
  E2B_API_KEY: apiKey,
}
delete cliEnv.E2B_DEBUG

integrationTest(
  'template list -f json returns templates from the API',
  { timeout: 60_000 },
  () => {
    const res = runCli(['template', 'list', '-f', 'json'], {
      env: cliEnv,
      timeoutMs: 30_000,
    })

    expect(res.status).toBe(0)

    const templates = JSON.parse(bufferToText(res.stdout))
    expect(Array.isArray(templates)).toBe(true)

    // The endpoint is team-scoped via the API key — every returned template
    // should carry the core fields the table/JSON output relies on.
    for (const template of templates) {
      expect(typeof template.templateID).toBe('string')
      expect(typeof template.public).toBe('boolean')
      expect(Array.isArray(template.aliases)).toBe(true)
    }
  }
)
