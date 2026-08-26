import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { load } from 'https://deno.land/std@0.224.0/dotenv/mod.ts'

await load({ envPath: '.env', export: true })

import { Sandbox } from '../../../dist/index.mjs'

Deno.test('Deno test', async () => {
  const sbx = await Sandbox.create({ timeoutMs: 5_000 })

  try {
    const result = await sbx.runCode('print("Hello, World!")')
    assertEquals(result.logs.stdout.join(''), 'Hello, World!\n')
  } finally {
    await sbx.kill()
  }
})
