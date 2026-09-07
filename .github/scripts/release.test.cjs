const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const script = path.join(__dirname, 'release.cjs')
const { groups, groupOf } = require('./release.cjs')

const packages = {
  'js-sdk': { name: 'e2b', version: '2.47.0' },
  'python-sdk': {
    name: '@e2b/python-sdk',
    version: '2.47.0',
    private: true,
    scripts: { postVersion: 'uv version', postPublish: 'uv publish' },
  },
  cli: {
    name: '@e2b/cli',
    version: '2.18.1',
    dependencies: { e2b: 'workspace:^' },
  },
  'code-interpreter-js': {
    name: '@e2b/code-interpreter',
    version: '2.8.0',
    dependencies: { e2b: 'workspace:^' },
  },
  'code-interpreter-python': {
    name: '@e2b/code-interpreter-python',
    version: '2.10.0',
    private: true,
    scripts: { postVersion: 'uv version', postPublish: 'uv publish' },
  },
  'desktop-js': {
    name: '@e2b/desktop',
    version: '2.4.0',
    dependencies: { e2b: 'workspace:^' },
  },
  'desktop-python': {
    name: '@e2b/desktop-python',
    version: '2.5.0',
    private: true,
    scripts: { postVersion: 'uv version', postPublish: 'uv publish' },
  },
}

const changelog = `# e2b

## 2.47.0

### Minor Changes

- 1980d6b: Add \`onResume\`.

### Patch Changes

- cd921aa: Bump deps.

## 2.46.1

### Patch Changes

- d4a7f41: Deprecate git.
`

// Every stub appends "<tool> <args>[ @ <cwd relative to the fixture>]" to
// $RELEASE_COMMANDS and fails when that line equals $FAIL_COMMAND.
const stubPrelude = (tool) => `#!/bin/sh
rel="\${PWD#"$FIXTURE_ROOT"}"; rel="\${rel#/}"
line="${tool} $*\${rel:+ @ $rel}"
printf '%s\\n' "$line" >> "$RELEASE_COMMANDS"
[ "$line" = "$FAIL_COMMAND" ] && exit 1
`

const stubs = {
  pnpm: `${stubPrelude('pnpm')}
if [ "$1 $2" = "changeset version" ]; then rm -f .changeset/*.md; fi
exit 0
`,
  // \`npm view <name>@<version> version --json\`: published when listed in $PUBLISHED.
  npm: `${stubPrelude('npm')}
for spec in $PUBLISHED; do
  [ "$spec" = "$2" ] && { echo '"1.0.0"'; exit 0; }
done
echo '{"error":{"code":"E404"}}'
exit 1
`,
  // \`git ls-remote --exit-code --tags origin refs/tags/<tag>\`: exists when listed in $EXISTING_TAGS.
  git: `${stubPrelude('git')}
if [ "$1" = "ls-remote" ]; then
  for tag in $EXISTING_TAGS; do
    [ "refs/tags/$tag" = "$5" ] && exit 0
  done
  exit 2
fi
exit 0
`,
  // \`gh release create <tag> --title <tag> --notes-file <file> [--prerelease]\`
  gh: `${stubPrelude('gh')}
cp "$7" "$RELEASE_NOTES/$(echo "$3" | tr / _)"
exit 0
`,
  uv: `${stubPrelude('uv')}
exit 0
`,
}

function fixture(t, { changesets = {}, changelogs = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  fs.mkdirSync(path.join(root, '.changeset'))
  for (const [id, { releases, summary = 'Change.' }] of Object.entries(
    changesets
  )) {
    const frontmatter = Object.entries(releases)
      .map(([name, type]) => `'${name}': ${type}`)
      .join('\n')
    fs.writeFileSync(
      path.join(root, '.changeset', `${id}.md`),
      `---\n${frontmatter}\n---\n\n${summary}\n`
    )
  }
  for (const [dir, packageJson] of Object.entries(packages)) {
    const pkgDir = path.join(root, 'packages', dir)
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(packageJson)
    )
    if (changelogs[dir])
      fs.writeFileSync(path.join(pkgDir, 'CHANGELOG.md'), changelogs[dir])
    if (packageJson.private) fs.writeFileSync(path.join(pkgDir, 'uv.lock'), '')
  }

  const bin = path.join(root, 'bin')
  fs.mkdirSync(bin)
  for (const [tool, source] of Object.entries(stubs)) {
    fs.writeFileSync(path.join(bin, tool), source, { mode: 0o755 })
  }
  const notes = path.join(root, 'notes')
  fs.mkdirSync(notes)

  const commandsLog = path.join(root, 'commands')
  return {
    root,
    changesetFiles: () => fs.readdirSync(path.join(root, '.changeset')).sort(),
    notes: (tag) =>
      fs.readFileSync(path.join(notes, tag.replaceAll('/', '_')), 'utf8'),
    run(args, env = {}) {
      const result = spawnSync(process.execPath, [script, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_OUTPUT: '',
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          FIXTURE_ROOT: root,
          RELEASE_COMMANDS: commandsLog,
          RELEASE_NOTES: notes,
          FAIL_COMMAND: '',
          PUBLISHED: '',
          EXISTING_TAGS: '',
          PYPI_TOKEN: 'pypi-token',
          ...env,
        },
      })
      return {
        ...result,
        commands: fs.existsSync(commandsLog)
          ? fs.readFileSync(commandsLog, 'utf8').trim().split('\n')
          : [],
      }
    },
  }
}

function statusFile(t, releases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-status-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'status.json')
  fs.writeFileSync(file, JSON.stringify({ releases }))
  return file
}

const pending = {
  'sdk-feature': { releases: { e2b: 'minor', '@e2b/python-sdk': 'minor' } },
  'cli-fix': { releases: { '@e2b/cli': 'patch' } },
  'desktop-fix': { releases: { '@e2b/desktop-python': 'patch' } },
}

test('every workspace package belongs to exactly one release group', () => {
  const grouped = Object.values(groups).flatMap((group) =>
    Object.keys(group.packages)
  )
  assert.deepEqual(
    [...grouped].sort(),
    Object.values(packages)
      .map((pkg) => pkg.name)
      .sort()
  )
  assert.equal(grouped.length, new Set(grouped).size)
  assert.equal(groupOf('@e2b/cli'), 'cli')
  assert.equal(groupOf('unknown'), undefined)
})

test('check accepts changesets that each stay within one release group', (t) => {
  const result = fixture(t, { changesets: pending }).run(['check'])
  assert.equal(result.status, 0, result.stderr)
})

test('check rejects a changeset that spans release groups or names an unknown package', (t) => {
  const result = fixture(t, {
    changesets: {
      ...pending,
      mixed: { releases: { e2b: 'minor', '@e2b/cli': 'minor' } },
      stray: { releases: { '@e2b/unknown': 'patch' } },
    },
  }).run(['check'])
  assert.notEqual(result.status, 0)
  assert.match(
    result.stderr,
    /\.changeset\/mixed\.md: releases packages from several release groups \(e2b, cli\)/
  )
  assert.match(
    result.stderr,
    /\.changeset\/stray\.md: "@e2b\/unknown" does not belong to any release group/
  )
})

const allTags = Object.values(packages)
  .map((pkg) => `${pkg.name}@${pkg.version}`)
  .join(' ')

test('plan reports no release when no changeset names the group and every version is tagged', (t) => {
  const result = fixture(t, { changesets: pending }).run(
    ['plan', 'code-interpreter', statusFile(t, [])],
    { EXISTING_TAGS: allTags }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, 'release=false\npackages=[]\nitinerary=\n')
})

test('plan releases a group package whose current version was never tagged', (t) => {
  const result = fixture(t, { changesets: pending }).run(
    ['plan', 'code-interpreter', statusFile(t, [])],
    { EXISTING_TAGS: '@e2b/code-interpreter@2.8.0' }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    result.stdout,
    'release=true\npackages=["@e2b/code-interpreter-python"]\nitinerary=• Python SDK (e2b-code-interpreter) v2.10.0 (unpublished)\n'
  )
})

test('plan lists only the group packages named by changesets with their new versions', (t) => {
  const status = statusFile(t, [
    { name: 'e2b', oldVersion: '2.47.0', newVersion: '2.48.0' },
    { name: '@e2b/python-sdk', oldVersion: '2.47.0', newVersion: '2.48.0' },
    { name: '@e2b/cli', oldVersion: '2.18.1', newVersion: '2.18.2' },
  ])
  const e2b = fixture(t, { changesets: pending }).run(['plan', 'e2b', status], {
    EXISTING_TAGS: allTags,
  })
  assert.equal(e2b.status, 0, e2b.stderr)
  assert.equal(
    e2b.stdout,
    'release=true\npackages=["e2b","@e2b/python-sdk"]\nitinerary<<EOF\n• JS SDK (e2b) v2.48.0\n• Python SDK (e2b) v2.48.0\nEOF\n'
  )

  const desktop = fixture(t, { changesets: pending }).run(
    ['plan', 'desktop', status],
    {
      EXISTING_TAGS: allTags,
    }
  )
  assert.equal(desktop.status, 0, desktop.stderr)
  assert.equal(
    desktop.stdout,
    'release=true\npackages=["@e2b/desktop-python"]\nitinerary=• Python SDK (e2b-desktop)\n'
  )
})

test('plan fails on a changeset that spans release groups', (t) => {
  const result = fixture(t, {
    changesets: { mixed: { releases: { e2b: 'minor', '@e2b/cli': 'minor' } } },
  }).run(['plan', 'e2b', statusFile(t, [])])
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, '')
})

test('version consumes only the group changesets, syncs only the group Python versions and re-locks every uv.lock', (t) => {
  const repo = fixture(t, { changesets: pending })
  const result = repo.run(['version', 'e2b'])
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands, [
    'pnpm changeset version',
    'pnpm --filter @e2b/python-sdk run postVersion',
    'uv lock @ packages/code-interpreter-python',
    'uv lock @ packages/desktop-python',
    'uv lock @ packages/python-sdk',
  ])
  assert.equal(result.stdout, 'versioned=true\n')
  assert.deepEqual(repo.changesetFiles(), ['cli-fix.md', 'desktop-fix.md'])
})

test('version restores the parked changesets when changeset version fails', (t) => {
  const repo = fixture(t, { changesets: pending })
  const result = repo.run(['version', 'cli'], {
    FAIL_COMMAND: 'pnpm changeset version',
  })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, ['pnpm changeset version'])
  assert.deepEqual(repo.changesetFiles(), [
    'cli-fix.md',
    'desktop-fix.md',
    'sdk-feature.md',
  ])
})

test('version is a no-op when no changeset names the group', (t) => {
  const repo = fixture(t, { changesets: pending })
  const result = repo.run(['version', 'code-interpreter'])
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands, [])
  assert.match(
    result.stdout,
    /No changesets release the "code-interpreter" group/
  )
  assert.match(result.stdout, /versioned=false\n$/)
  assert.deepEqual(repo.changesetFiles(), [
    'cli-fix.md',
    'desktop-fix.md',
    'sdk-feature.md',
  ])
})

const e2bTag = 'e2b@2.47.0'
const pythonTag = '@e2b/python-sdk@2.47.0'
const publishE2b = [
  `git ls-remote --exit-code --tags origin refs/tags/${e2bTag}`,
  `npm view ${e2bTag} version --json`,
  'pnpm publish --access public --tag latest --no-git-checks @ packages/js-sdk',
  `git tag ${e2bTag} -m ${e2bTag}`,
  `git push origin ${e2bTag}`,
]
const publishPython = [
  `git ls-remote --exit-code --tags origin refs/tags/${pythonTag}`,
  'pnpm --filter @e2b/python-sdk run postPublish',
  `git tag ${pythonTag} -m ${pythonTag}`,
  `git push origin ${pythonTag}`,
]
const release = (tag) =>
  new RegExp(
    `^gh release create ${tag} --title ${tag} --notes-file .*/notes\\.md$`
  )

test('publish uploads, tags and releases each group package in turn', (t) => {
  const repo = fixture(t, { changelogs: { 'js-sdk': changelog } })
  const result = repo.run(['publish', 'e2b'])
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands.slice(0, 5), publishE2b)
  assert.match(result.commands[5], release(e2bTag))
  assert.deepEqual(result.commands.slice(6, 10), publishPython)
  assert.match(result.commands[10], release(pythonTag))
  assert.equal(result.commands.length, 11)
  assert.equal(
    repo.notes(e2bTag),
    '### Minor Changes\n\n- 1980d6b: Add `onResume`.\n\n### Patch Changes\n\n- cd921aa: Bump deps.'
  )
  assert.equal(repo.notes(pythonTag), '')
  assert.match(
    result.stdout,
    /New tag: e2b@2\.47\.0\nNew tag: @e2b\/python-sdk@2\.47\.0/
  )
})

test('publish skips packages whose tag already exists', (t) => {
  const result = fixture(t).run(['publish', 'e2b'], { EXISTING_TAGS: e2bTag })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.commands[0], publishE2b[0])
  assert.deepEqual(result.commands.slice(1, 5), publishPython)
  assert.equal(result.commands.length, 6)
  assert.match(result.stdout, /Skipping e2b@2\.47\.0 \(already released\)/)
})

test('publish tags a version that reached npm without being tagged', (t) => {
  const result = fixture(t).run(['publish', 'e2b'], { PUBLISHED: e2bTag })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands.slice(0, 4), [
    publishE2b[0],
    publishE2b[1],
    publishE2b[3],
    publishE2b[4],
  ])
  assert.match(result.commands[4], release(e2bTag))
})

test('a failed npm publish leaves no tag or release', (t) => {
  const result = fixture(t).run(['publish', 'e2b'], {
    FAIL_COMMAND: publishE2b[2],
  })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, publishE2b.slice(0, 3))
  assert.doesNotMatch(result.stdout, /New tag/)
})

test('a failed Python upload leaves no tag or release', (t) => {
  const result = fixture(t).run(['publish', 'e2b'], {
    EXISTING_TAGS: e2bTag,
    FAIL_COMMAND: publishPython[1],
  })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [
    publishE2b[0],
    ...publishPython.slice(0, 2),
  ])
})

test('publish builds workspace dependencies that are already on npm', (t) => {
  const result = fixture(t).run(['publish', 'cli'], { PUBLISHED: e2bTag })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands.slice(0, 5), [
    `npm view ${e2bTag} version --json`,
    'pnpm --filter e2b run build',
    'git ls-remote --exit-code --tags origin refs/tags/@e2b/cli@2.18.1',
    'npm view @e2b/cli@2.18.1 version --json',
    'pnpm publish --access public --tag latest --no-git-checks @ packages/cli',
  ])
})

test('publish refuses a package whose workspace dependency is not on npm', (t) => {
  const result = fixture(t).run(['publish', 'desktop'])
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [`npm view ${e2bTag} version --json`])
  assert.match(
    result.stderr,
    /@e2b\/desktop depends on e2b@2\.47\.0, which is not published to npm; release the "e2b" group first/
  )
})

test('publish refuses to start a group with Python packages without a PyPI token', (t) => {
  const result = fixture(t).run(['publish', 'e2b'], { PYPI_TOKEN: '' })
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [])
  assert.match(
    result.stderr,
    /PYPI_TOKEN is not set, but the "e2b" group publishes to PyPI/
  )

  const cli = fixture(t).run(['publish', 'cli'], {
    PYPI_TOKEN: '',
    PUBLISHED: e2bTag,
  })
  assert.equal(cli.status, 0, cli.stderr)
})

test('an unknown group is rejected before anything runs', (t) => {
  const result = fixture(t).run(['publish', 'sdk'])
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [])
  assert.match(result.stderr, /Unknown release group "sdk"/)
})
