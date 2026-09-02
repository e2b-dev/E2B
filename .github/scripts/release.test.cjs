const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const { scripts } = require('../../package.json')

function publish(t, fail = '') {
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
