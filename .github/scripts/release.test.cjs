const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const script = (name) => path.join(__dirname, name)
const packages = {
  'js-sdk': { name: 'e2b' },
  'python-sdk': {
    name: '@e2b/python-sdk',
    dependencies: { '@e2b/dockerfile-utils-python': 'workspace:*' },
  },
  'code-interpreter-python': {
    name: '@e2b/code-interpreter-python',
    dependencies: { '@e2b/python-sdk': 'workspace:*' },
  },
  'desktop-python': { name: '@e2b/desktop-python' },
  'dockerfile-utils-python': { name: '@e2b/dockerfile-utils-python' },
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const cwd = path.join(root, 'source')
  const publisher = path.join(root, 'saved publisher')
  fs.mkdirSync(publisher)
  for (const name of ['publish_selected.cjs', 'publish_python_sdk.sh']) {
    fs.copyFileSync(script(name), path.join(publisher, name))
  }
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), content)
  }
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n")
  write(
    'record.cjs',
    `const fs = require('node:fs')
fs.appendFileSync(process.env.PUBLISH_LOG, process.argv[2] + '\\n')
if (process.env.FAIL_PACKAGE === process.argv[2]) process.exit(1)
`
  )
  write(
    'package.json',
    JSON.stringify({
      private: true,
      scripts: {
        changeset: 'node record.cjs npm',
        publish: 'pnpm run -r postPublish && pnpm changeset publish',
        'publish:python-sdk': 'sh .github/scripts/publish_python_sdk.sh',
      },
    })
  )
  for (const [directory, pkg] of Object.entries(packages)) {
    write(
      `packages/${directory}/package.json`,
      JSON.stringify({
        ...pkg,
        version: '1.0.0',
        scripts: {
          [directory === 'js-sdk' ? 'build' : 'postPublish']:
            `node ../../record.cjs ${directory}`,
        },
      })
    )
  }
  write(
    '.github/scripts/publish_python_sdk.sh',
    fs.readFileSync(script('publish_python_sdk.sh'))
  )
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
  const commit = (message) => {
    git('add', '.')
    git('-c', 'commit.gpgsign=false', 'commit', '-qm', message)
    return git('rev-parse', 'HEAD')
  }
  git('init', '-q')
  git('config', 'user.name', 'Release test')
  git('config', 'user.email', 'release-test@example.invalid')
  const initial = commit('Initial packages')
  return { cwd, write, publisher, git, commit, initial }
}

function runPublisher({ cwd, publisher }, fail = '') {
  const log = path.join(cwd, 'calls')
  const result = spawnSync(
    process.execPath,
    [path.join(publisher, 'publish_selected.cjs'), 'plan.json'],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PUBLISH_LOG: log, FAIL_PACKAGE: fail },
    }
  )
  return {
    ...result,
    calls: fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').trim().split('\n')
      : [],
  }
}

function publish(t, names, fail = '') {
  const files = fixture(t)
  files.write(
    'plan.json',
    JSON.stringify({ releases: names.map((name) => ({ name })) })
  )
  return runPublisher(files, fail)
}

test('mixed releases publish only selected Python packages in dependency order', (t) => {
  const result = publish(
    t,
    ['e2b', '@e2b/python-sdk', '@e2b/code-interpreter-python'],
    'desktop-python'
  )
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.calls, [
    'js-sdk',
    'python-sdk',
    'code-interpreter-python',
    'npm',
  ])
})

test('Python-only and npm-only releases do not publish unrelated packages', async (t) => {
  for (const [names, calls] of [
    [['@e2b/python-sdk'], ['python-sdk']],
    [['e2b'], ['js-sdk', 'npm']],
  ]) {
    await t.test(names.join(', '), (t) => {
      const result = publish(t, names, 'desktop-python')
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(result.calls, calls)
    })
  }
})

test('a selected Python publication failure stops npm publishing', (t) => {
  const result = publish(t, ['e2b', '@e2b/python-sdk'], 'python-sdk')
  assert.notEqual(result.status, 0)
  assert.deepEqual(result.calls, ['js-sdk', 'python-sdk'])
})

test('normal dispatch without changesets produces no release', (t) => {
  const { cwd, write } = fixture(t)
  write('.changeset/README.md', 'No pending releases\n')
  const plan = path.join(cwd, 'plan.json')
  execFileSync(process.execPath, [script('release_plan.cjs'), plan], {
    cwd,
    env: { ...process.env, RECOVERY_COMMIT: '' },
  })
  assert.equal(
    execFileSync('sh', [script('is_release.sh'), plan], {
      encoding: 'utf8',
    }).trim(),
    'false'
  )
})

test('Python-only recovery uses the saved publisher and tags the release commit', (t) => {
  const files = fixture(t)
  const { cwd, write, publisher, git, commit } = files
  const file = 'packages/python-sdk/package.json'
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf8'))
  write(file, JSON.stringify({ ...pkg, version: '1.1.0' }))
  write('.github/scripts/publish_python_sdk.sh', '#!/bin/sh\nexit 99\n')
  const release = commit('[skip ci] Release new versions')
  write(
    '.github/scripts/publish_python_sdk.sh',
    fs.readFileSync(script('publish_python_sdk.sh'))
  )
  commit('Fix Python publisher')

  fs.copyFileSync(
    path.join(cwd, '.github/scripts/publish_python_sdk.sh'),
    path.join(publisher, 'publish_python_sdk.sh')
  )
  execFileSync(process.execPath, [script('release_plan.cjs'), 'plan.json'], {
    cwd,
    env: { ...process.env, RECOVERY_COMMIT: release },
  })
  git('checkout', '-q', '--detach', release)
  const result = runPublisher(files)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.calls, ['python-sdk'])
  assert.match(result.stdout, /New tag: @e2b\/python-sdk@1.1.0/)
  assert.equal(git('rev-parse', '@e2b/python-sdk@1.1.0^{}'), release)
})

test('recovery derives version changes and test gates from the release commit', (t) => {
  const { cwd, write, git, commit, initial } = fixture(t)
  for (const directory of ['js-sdk', 'python-sdk', 'code-interpreter-python']) {
    const file = `packages/${directory}/package.json`
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf8'))
    write(file, JSON.stringify({ ...pkg, version: '1.1.0' }))
  }
  const release = commit('[skip ci] Release new versions')
  write('.github/workflows/fix.yml', 'name: Fixed publisher\n')
  commit('Fix publisher')
  const plan = path.join(cwd, 'plan.json')
  const prepare = (sha) =>
    spawnSync(process.execPath, [script('release_plan.cjs'), plan], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, RECOVERY_COMMIT: sha },
    })
  const result = prepare(release)
  assert.equal(result.status, 0, result.stderr)
  const releases = JSON.parse(fs.readFileSync(plan, 'utf8')).releases
  assert.deepEqual(releases.map(({ name }) => name).sort(), [
    '@e2b/code-interpreter-python',
    '@e2b/python-sdk',
    'e2b',
  ])
  assert.ok(releases.every(({ newVersion }) => newVersion === '1.1.0'))
  assert.equal(
    execFileSync('sh', [script('is_release.sh'), plan], {
      encoding: 'utf8',
    }).trim(),
    'true'
  )
  for (const [name, expected] of [
    ['@e2b/code-interpreter-python', 'true'],
    ['@e2b/desktop-python', 'false'],
  ]) {
    assert.equal(
      execFileSync('sh', [script('is_release_for_package.sh'), name, plan], {
        encoding: 'utf8',
      }).trim(),
      expected
    )
  }
  assert.notEqual(prepare(initial).status, 0)
  assert.notEqual(prepare('main').status, 0)
  fs.unlinkSync(plan)
  write('packages/python-sdk/source.py', '# Unreleased source change\n')
  const changed = commit('Change SDK source')
  assert.match(prepare(release).stderr, /Package or build inputs changed/)
  git('checkout', '-q', '--detach', initial)
  assert.notEqual(prepare(changed).status, 0)
})
