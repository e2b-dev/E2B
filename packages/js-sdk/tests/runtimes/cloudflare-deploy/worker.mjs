// Deployed to real Cloudflare infrastructure via `pnpm deploy:cf`
// (wrangler deploy --temporary). Imports the built ESM bundle so wrangler's
// bundling and workerd's production module semantics (e.g. import.meta.url
// being undefined, #1579) are exercised — the vitest-pool-workers suite
// polyfills those away.
import { Sandbox } from '../../../dist/index.mjs'

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 })
    }

    const { apiKey, domain, template } = await request.json()
    if (!apiKey || !template) {
      return Response.json(
        { ok: false, error: 'missing apiKey or template' },
        { status: 400 }
      )
    }

    try {
      const sbx = await Sandbox.create(template, {
        timeoutMs: 5_000,
        apiKey,
        domain,
      })
      try {
        const isRunning = await sbx.isRunning()

        const text = 'Hello, World!'
        const cmd = await sbx.commands.run(`echo "${text}"`)

        await sbx.files.write('test.txt', text)
        const content = await sbx.files.read('test.txt')

        return Response.json({
          ok:
            isRunning &&
            cmd.exitCode === 0 &&
            cmd.stdout === `${text}\n` &&
            content === text,
          isRunning,
          exitCode: cmd.exitCode,
          stdout: cmd.stdout,
          content,
        })
      } finally {
        await sbx.kill()
      }
    } catch (err) {
      return Response.json(
        { ok: false, error: String(err?.stack ?? err) },
        { status: 500 }
      )
    }
  },
}
