import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { load } from 'https://deno.land/std@0.224.0/dotenv/mod.ts'

await load({ envPath: '.env', export: true })

import { Sandbox } from '../../../dist/index.mjs'

Deno.test('Deno test', async () => {
  const sbx = await Sandbox.create('desktop', { timeoutMs: 60_000 })

  try {
    const size = await sbx.getScreenSize()
    assertEquals(size, { width: 1024, height: 768 })
  } finally {
    await sbx.kill()
  }
})
