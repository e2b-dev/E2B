const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const root = path.resolve(__dirname, '../..')
const { scripts } = require('../../package.json')
const packages = [
  'e2b',
  '@e2b/python-sdk',
  '@e2b/cli',
  '@e2b/code-interpreter',
  '@e2b/code-interpreter-python',
  '@e2b/desktop',
  '@e2b/desktop-python',
]

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-'))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  fs.mkdirSync(path.join(cwd, '.changeset'))
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(cwd, 'node_modules')
  )
  return cwd
}

function preflight(cwd, retry, name) {
  const script = name ? 'is_release_for_package.sh' : 'is_release.sh'
  return spawnSync(
    'sh',
    [path.join(__dirname, script), ...(name ? [name] : [])],
    {
      cwd,
      env: { ...process.env, PUBLISH_EXISTING: String(retry) },
      encoding: 'utf8',
    }
  )
}

test('normal releases still require changesets', (t) => {
  const result = preflight(fixture(t), false)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'false')
})

test('a retry with consumed changesets releases existing versions and tests every package', (t) => {
  const cwd = fixture(t)
  for (const name of [undefined, ...packages]) {
    const result = preflight(cwd, true, name)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), 'true', name)
  }
})

test('a retry rejects pending changesets instead of silently bumping versions', (t) => {
  const cwd = fixture(t)
  fs.writeFileSync(
    path.join(cwd, '.changeset/desktop.md'),
    "---\n'@e2b/desktop': patch\n---\nWait for desktop readiness.\n"
  )
  const result = preflight(cwd, true)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /pending changesets/i)
  assert.equal(preflight(cwd, false).stdout.trim(), 'true')
  assert.equal(preflight(cwd, false, '@e2b/desktop').stdout.trim(), 'true')
  assert.equal(preflight(cwd, false, 'e2b').stdout.trim(), 'false')
})

function publish(t, fail = '') {
  const cwd = fixture(t)
  const bin = path.join(cwd, 'bin')
  fs.mkdirSync(bin)
  // Never invoke a registry publisher. Record the real root script's commands.
  fs.writeFileSync(
    path.join(bin, 'pnpm'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$RELEASE_COMMANDS"\n[ "$*" != "$FAIL_COMMAND" ]\n',
    { mode: 0o755 }
  )
  const log = path.join(cwd, 'commands')
  const result = spawnSync('sh', ['-c', scripts.publish], {
    cwd,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      RELEASE_COMMANDS: log,
      FAIL_COMMAND: fail,
    },
    encoding: 'utf8',
  })
  return {
    ...result,
    commands: fs.readFileSync(log, 'utf8').trim().split('\n'),
  }
}

const build = '--dir packages/js-sdk build'
const python = 'run -r postPublish'
const npm = 'changeset publish'

test('builds the workspace SDK even when npm skips its already-published version', (t) => {
  const result = publish(t)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands, [build, python, npm])
})

test('a dependency build failure prevents all publishing', (t) => {
  const result = publish(t, build)
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [build])
})

test('a Python publish failure prevents Changesets from tagging unpublished Python versions', (t) => {
  const result = publish(t, python)
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [build, python])
})

test('an npm failure remains a failed release after Python succeeds', (t) => {
  const result = publish(t, npm)
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [build, python, npm])
})
