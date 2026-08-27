import { defineConfig } from 'vitest/config'

import { createCloudflareVitestConfig } from '../../../../../vitest.cloudflare.config.mts'

// Error names thrown by src/errors.ts (plus CommandExitError) — the shapes
// this suite's rejection tests expect. Kept as a literal list so an unknown
// error class still fails the run instead of being silently ignored.
const SDK_ERROR_NAMES = new Set([
  'SandboxError',
  'TimeoutError',
  'InvalidArgumentError',
  'NotEnoughSpaceError',
  'NotFoundError',
  'FileNotFoundError',
  'SandboxNotFoundError',
  'AuthenticationError',
  'GitAuthError',
  'GitUpstreamError',
  'TemplateError',
  'RateLimitError',
  'BuildError',
  'FileUploadError',
  'VolumeError',
  'CommandExitError',
])

// Runs the unit + connectionConfig projects (same coverage as test:bun /
// test:deno) inside workerd, against src. The real-deploy suite
// (tests/runtimes/cloudflare-deploy) keeps covering the built bundle on actual
// Cloudflare infrastructure.
export default defineConfig(
  createCloudflareVitestConfig({
    exclude: [
      'tests/template/**',
      // Inspects the host-built dist/index.mjs via node:fs, which workerd's
      // virtual filesystem can never see (and throws in CI when the file is
      // "missing"); the Node unit project keeps running it.
      'tests/bundle/**',
    ],
    isExpectedRejection: (error, message) =>
      // SDK public errors — what `expect(p).rejects` asserts on.
      SDK_ERROR_NAMES.has(String(error.name)) ||
      // Stub rejection from tests/sandbox/git/validation.test.ts.
      message === 'commands.run should not be called',
  })
)
