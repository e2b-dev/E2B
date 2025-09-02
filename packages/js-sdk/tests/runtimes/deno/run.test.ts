import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { load } from 'https://deno.land/std@0.224.0/dotenv/mod.ts'

await load({ envPath: '.env', export: true })

import { Sandbox } from '../../../dist/index.mjs'
import { template } from '../../template'

Deno.test('Deno test', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
  try {
    const isRunning = await sbx.isRunning()
    assert(isRunning)

    const text = 'Hello, World!'

    const cmd = await sbx.commands.run(`echo "${text}"`)

    assertEquals(cmd.exitCode, 0)
    assertEquals(cmd.stdout, `${text}\n`)
  } finally {
    await sbx.kill()
  }
})
