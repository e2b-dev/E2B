// Browsers have no `process`: `getEnvVar` (src/api/metadata.ts) resolves to ''
// there, so E2B_* can only reach a browser app through whatever shim its
// bundler injects. Provide that shim — the same thing workerd's nodejs_compat
// gives the Cloudflare suite for free — so the shared suites can configure the
// SDK from the environment like they do on every other runtime.
//
// `process.env` aliases Vite's `import.meta.env`, which is where vitest puts
// the config's `env` and what `vi.stubEnv` writes to in browser mode, so env
// reads and stubbing both behave as they do on Node.
//
// Only `env` is defined: `process.release` must stay absent or the SDK would
// detect the runtime as 'node' instead of 'browser'. Tests that need a
// browser without any `process` at all delete it themselves — see
// noProcessGlobal.test.ts.
Object.assign(globalThis, { process: { env: import.meta.env } })
