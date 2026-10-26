const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const output = process.argv[2]
const recoveryCommit = process.env.RECOVERY_COMMIT
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

if (!recoveryCommit) {
  require('@changesets/read')
    .default(process.cwd())
    .then((changesets) => {
      if (changesets.length) {
        execFileSync('pnpm', ['changeset', 'status', `--output=${output}`], {
          stdio: 'inherit',
        })
      } else {
        fs.writeFileSync(output, JSON.stringify({ releases: [] }))
      }
    })
} else {
  if (!/^[a-f0-9]{40}$/.test(recoveryCommit)) {
    throw new Error('Recovery requires the full version-bump commit SHA')
  }
  git('merge-base', '--is-ancestor', recoveryCommit, 'HEAD')
  if (
    git('show', '-s', '--format=%s', recoveryCommit) !==
    '[skip ci] Release new versions'
  ) {
    throw new Error('Recovery must reference a release version-bump commit')
  }

  // Tests run on main. Only workflow fixes may differ from the recovered source.
  if (
    git('diff', '--name-only', recoveryCommit, 'HEAD', '--', '.', ':!.github')
  ) {
    throw new Error('Package or build inputs changed since the release commit')
  }

  const releases = fs.readdirSync('packages').flatMap((directory) => {
    const file = `packages/${directory}/package.json`
    const current = JSON.parse(git('show', `${recoveryCommit}:${file}`))
    const previous = JSON.parse(git('show', `${recoveryCommit}^:${file}`))
    return current.version === previous.version
      ? []
      : [{ name: current.name, newVersion: current.version }]
  })
  if (!releases.length) {
    throw new Error('The recovery commit contains no package version changes')
  }
  fs.writeFileSync(output, JSON.stringify({ releases }))
}
