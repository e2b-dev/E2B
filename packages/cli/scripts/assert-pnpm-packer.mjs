// The CLI depends on `e2b` through pnpm's `workspace:^` protocol, and only pnpm
// resolves that to a concrete version when it builds the tarball. Every other
// packer copies the protocol in verbatim, and installing the result fails with
// EUNSUPPORTEDPROTOCOL — so the CLI would be completely uninstallable.
//
// Nothing guarantees pnpm gets used: `changeset publish` picks its publish tool by
// detecting the package manager. Run as `prepack`, this fails on the real publish
// path before a tarball exists, rather than letting a broken one reach npm.

import fs from 'node:fs'
import path from 'node:path'

const manifestPath = path.join(import.meta.dirname, '..', 'package.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const workspaceRanges = Object.entries({
  ...manifest.dependencies,
  ...manifest.optionalDependencies,
  ...manifest.peerDependencies,
}).filter(([, range]) => range.startsWith('workspace:'))

if (workspaceRanges.length === 0) {
  process.exit(0)
}

const packer = process.env.npm_config_user_agent ?? ''

if (!packer.startsWith('pnpm/')) {
  const packerName = packer || 'an unrecognized package manager'

  console.error(
    [
      `Refusing to pack ${manifest.name} with "${packerName}".`,
      '',
      ...workspaceRanges.map(([name, range]) => `  ${name}: ${range}`),
      '',
      'Only pnpm resolves the workspace: protocol into a concrete version. Any',
      'other packer writes it into the tarball as-is, and installing that fails',
      'with EUNSUPPORTEDPROTOCOL. Use `pnpm pack` / `pnpm publish`.',
    ].join('\n')
  )
  process.exit(1)
}
