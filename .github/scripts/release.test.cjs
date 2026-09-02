const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const { scripts } = require('../../package.json')
const root = path.resolve(__dirname, '../..')
const { version } = require('../../packages/python-sdk/package.json')

function publish(t, fail = '', script = scripts.publish) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-'))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  const bin = path.join(cwd, 'bin')
  fs.mkdirSync(bin)
  // Never invoke a registry publisher. Record the real root script's commands.
  fs.writeFileSync(
    path.join(bin, 'pnpm'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$RELEASE_COMMANDS"\n[ "$*" != "$FAIL_COMMAND" ]\n',
    { mode: 0o755 }
  )
  fs.writeFileSync(
    path.join(bin, 'git'),
    '#!/bin/sh\nprintf "git %s\\n" "$*" >> "$RELEASE_COMMANDS"\n[ "git $*" != "$FAIL_COMMAND" ]\n',
    { mode: 0o755 }
  )
  const log = path.join(cwd, 'commands')
  const result = spawnSync('sh', ['-c', script], {
    cwd: root,
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
    commands: fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').trim().split('\n')
      : [],
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

function publishCommand(t, releases) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-plan-'))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  const plan = path.join(cwd, 'plan.json')
  fs.writeFileSync(plan, JSON.stringify({ releases }))
  return spawnSync(
    process.execPath,
    [path.join(__dirname, 'publish_command.cjs'), plan],
    {
      encoding: 'utf8',
    }
  )
}

test('a Python SDK-only release plan selects the isolated publisher', (t) => {
  const result = publishCommand(t, [
    {
      name: '@e2b/python-sdk',
      type: 'patch',
      oldVersion: '2.46.3',
      newVersion: '2.46.4',
    },
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'pnpm run publish:python-sdk')
})

test('other release plans retain the workspace publisher', (t) => {
  for (const releases of [
    [{ name: 'e2b' }],
    [{ name: '@e2b/python-sdk' }, { name: '@e2b/desktop' }],
  ]) {
    const result = publishCommand(t, releases)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), 'pnpm run publish')
  }
})

test('an empty release plan cannot default to publishing everything', (t) => {
  const result = publishCommand(t, [])
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, '')
})

const sdkPython = '--filter @e2b/python-sdk run postPublish'
const sdkTag = `@e2b/python-sdk@${version}`
const tagCommand = `git tag -a ${sdkTag} -m ${sdkTag}`
const sdkScript = scripts['publish:python-sdk']

test('the isolated publisher uploads and tags only the base Python SDK', (t) => {
  const result = publish(t, '', sdkScript)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.commands, [sdkPython, tagCommand])
  assert.equal(result.stdout.trim(), `New tag: ${sdkTag}`)
})

test('a failed SDK upload creates no tag or release marker', (t) => {
  const result = publish(t, sdkPython, sdkScript)
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [sdkPython])
  assert.equal(result.stdout, '')
})

test('a failed tag command emits no release marker', (t) => {
  const result = publish(t, tagCommand, sdkScript)
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.commands, [sdkPython, tagCommand])
  assert.equal(result.stdout, '')
})
