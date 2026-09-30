import { assert, test } from 'vitest'

import { template } from '../../template'

// Bundlers don't give browser apps a `process` unless asked to, so the SDK has
// to be fully configurable through explicit options — `getEnvVar`
// (src/api/metadata.ts) returns '' when `process` is missing rather than
// throwing. The rest of this suite runs against the `process.env` shim from
// processEnv.setup.ts, which would mask a regression that reintroduces a bare
// `process` read on the create path, so this test drops the shim entirely and
// drives a real sandbox the way a browser app has to.
//
// The SDK is imported dynamically inside the test, after the shim is gone: a
// static import is evaluated at collection time, while the shim is still
// installed, which would let a top-level `process` read anywhere in the module
// graph pass here and still crash a browser app on import.
//
// Config comes from `import.meta.env` (where vitest puts the config's `env`),
// which is also how a Vite app would hand its own build-time values over.
const apiKey = import.meta.env.E2B_API_KEY
const domain = import.meta.env.E2B_DOMAIN || undefined
const isDebug = import.meta.env.E2B_DEBUG !== undefined

test.skipIf(isDebug)(
  'drives a sandbox with no process global',
  async () => {
    const shim = Reflect.getOwnPropertyDescriptor(globalThis, 'process')
    Reflect.deleteProperty(globalThis, 'process')
    assert.equal(typeof process, 'undefined')

    try {
      const { Sandbox } = await import('../../../src')
      const sandbox = await Sandbox.create(template, { apiKey, domain })

      try {
        await sandbox.files.write('hello.txt', 'Hello World')
        assert.equal(await sandbox.files.read('hello.txt'), 'Hello World')

        const result = await sandbox.commands.run('echo "from the browser"')
        assert.equal(result.exitCode, 0)
        assert.equal(result.stdout.trim(), 'from the browser')
      } finally {
        await sandbox.kill()
      }
    } finally {
      if (shim) Reflect.defineProperty(globalThis, 'process', shim)
    }
  },
  60_000
)
