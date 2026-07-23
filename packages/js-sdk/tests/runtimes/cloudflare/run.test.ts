import { env } from 'cloudflare:test'
import { expect, test } from 'vitest'

// Import the built ESM bundle — the artifact Workers users actually load.
// Importing src would bypass bundling regressions like #1579, where an
// eager createRequire shim emitted by tsdown crashed workerd at import.
import { Sandbox } from '../../../dist/index.mjs'
import { template } from '../../template'

const apiKey = (env as Record<string, string>).E2B_API_KEY
const domain = (env as Record<string, string>).E2B_DOMAIN || undefined

test('Cloudflare Workers test', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: 5_000,
    apiKey,
    domain,
  })
  try {
    const isRunning = await sbx.isRunning()
    expect(isRunning).toBeTruthy()

    const text = 'Hello, World!'

    const cmd = await sbx.commands.run(`echo "${text}"`)

    expect(cmd.exitCode).toBe(0)
    expect(cmd.stdout).toEqual(`${text}\n`)

    await sbx.files.write('test.txt', text)
    const content = await sbx.files.read('test.txt')

    expect(content).toEqual(text)
  } finally {
    await sbx.kill()
  }
})
