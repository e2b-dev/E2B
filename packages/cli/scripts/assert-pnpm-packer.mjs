// The CLI depends on `e2b` through pnpm's `workspace:^` protocol. Only pnpm
// rewrites that to a concrete version while building the tarball; every other
// packer copies it in verbatim, and installing the result fails with
// EUNSUPPORTEDPROTOCOL.
//
// This is a cheap local backstop, not the guarantee: a lifecycle script cannot see
// the paths that skip lifecycle scripts (`--ignore-scripts`, `npm install -g .`).
// What actually guarantees the rewrite is `pkg_artifacts.yml`, which installs the
// packed tarball with npm on every PR.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Dependency protocols that only pnpm resolves — npm rejects all of them.
const PNPM_ONLY_PROTOCOL = /^(workspace|catalog|link):/

const manifestPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json'
)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const unresolved = Object.entries({
  ...manifest.dependencies,
  ...manifest.optionalDependencies,
  ...manifest.peerDependencies,
}).filter(([, range]) => PNPM_ONLY_PROTOCOL.test(range))

// Not `npm_config_user_agent`: that is inherited, so an npm spawned from pnpm —
// which is exactly what a `changeset publish` tool-detection regression would do —
// still reports `pnpm/…`. `npm_execpath` names the binary that is really packing.
const packer = path.basename(process.env.npm_execpath ?? '')

if (unresolved.length > 0 && !packer.includes('pnpm')) {
  console.error(
    [
      `Refusing to pack ${manifest.name} with "${packer || 'an unrecognized package manager'}".`,
      '',
      ...unresolved.map(([name, range]) => `  ${name}: ${range}`),
      '',
      'Only pnpm resolves these protocols into concrete versions. Any other packer',
      'writes them into the tarball as-is, and installing that fails with',
      'EUNSUPPORTEDPROTOCOL. Use `pnpm pack` / `pnpm publish`.',
    ].join('\n')
  )
  process.exit(1)
}
