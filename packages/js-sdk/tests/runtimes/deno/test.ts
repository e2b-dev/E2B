import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { Sandbox } from "npm:e2b@0.16.2-beta.26";

await load({envPath: "../../../.env", export: true})

Deno.test("Deno test", async () => {
  const sbx = await Sandbox.create("base", { timeoutMs: 5_000 })
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
