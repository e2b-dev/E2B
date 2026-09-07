#!/usr/bin/env node

// Release tooling behind the per-group release workflows
// (.github/workflows/release_*.yml). Every package belongs to exactly one
// release group, and each group is versioned and published on its own from the
// changesets that name its packages.
//
//   node release.cjs check                       fail on changesets that span groups
//   node release.cjs plan <group> <status.json>  GitHub Actions outputs for the group
//   node release.cjs version <group>             `changeset version` for the group only
//   node release.cjs publish <group>             publish, tag and release the group

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const readChangesets = require('@changesets/read').default

const groups = {
  e2b: {
    label: 'E2B SDK',
    packages: {
      e2b: 'JS SDK (e2b)',
      '@e2b/python-sdk': 'Python SDK (e2b)',
    },
  },
  cli: {
    label: 'CLI',
    packages: {
      '@e2b/cli': 'CLI (@e2b/cli)',
    },
  },
  'code-interpreter': {
    label: 'Code Interpreter SDK',
    packages: {
      '@e2b/code-interpreter': 'JS SDK (@e2b/code-interpreter)',
      '@e2b/code-interpreter-python': 'Python SDK (e2b-code-interpreter)',
    },
  },
  desktop: {
    label: 'Desktop SDK',
    packages: {
      '@e2b/desktop': 'JS SDK (@e2b/desktop)',
      '@e2b/desktop-python': 'Python SDK (e2b-desktop)',
    },
  },
}

function groupOf(packageName) {
  return Object.keys(groups).find(
    (name) => packageName in groups[name].packages
  )
}

function getGroup(name) {
  if (!(name in groups)) {
    throw new Error(
      `Unknown release group "${name}"; expected one of: ${Object.keys(groups).join(', ')}`
    )
  }
  return groups[name]
}

function workspacePackages(cwd) {
  const packagesDir = path.join(cwd, 'packages')
  const packages = new Map()
  for (const entry of fs.readdirSync(packagesDir)) {
    const dir = path.join(packagesDir, entry)
    const manifest = path.join(dir, 'package.json')
    if (!fs.existsSync(manifest)) continue
    const packageJson = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    packages.set(packageJson.name, { dir, packageJson })
  }
  return packages
}

function groupPackages(cwd, groupName) {
  const packages = workspacePackages(cwd)
  return Object.keys(getGroup(groupName).packages).map((name) => {
    const pkg = packages.get(name)
    if (!pkg) throw new Error(`Package "${name}" is not in the workspace`)
    return { name, ...pkg }
  })
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `\`${[command, ...args].join(' ')}\` exited with code ${result.status}`
    )
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error) throw result.error
  return result
}

async function check(cwd) {
  const changesets = await readChangesets(cwd)
  const problems = []
  for (const changeset of changesets) {
    const file = `.changeset/${changeset.id}.md`
    const touched = new Set()
    for (const { name } of changeset.releases) {
      const group = groupOf(name)
      if (group) {
        touched.add(group)
      } else {
        problems.push(`${file}: "${name}" does not belong to any release group`)
      }
    }
    if (touched.size > 1) {
      problems.push(
        `${file}: releases packages from several release groups (${[...touched].join(', ')}); split it into one changeset per group`
      )
    }
  }
  if (problems.length > 0) {
    throw new Error(problems.join('\n'))
  }
  return changesets
}

function inGroup(changeset, groupName) {
  const { packages } = getGroup(groupName)
  return changeset.releases.some(({ name }) => name in packages)
}

// A group is released when a changeset names one of its packages, or when one
// of them sits at a version that never got its tag — a previous release of the
// group bumped and committed it but failed before publishing.
async function plan(cwd, groupName, statusFile) {
  const group = getGroup(groupName)
  const changesets = await check(cwd)
  const named = new Set(
    changesets
      .filter((changeset) => inGroup(changeset, groupName))
      .flatMap((changeset) => changeset.releases.map(({ name }) => name))
  )
  const { releases } = JSON.parse(fs.readFileSync(statusFile, 'utf8'))
  const bumped = new Map(releases.map((r) => [r.name, r.newVersion]))

  const itinerary = []
  const packages = []
  for (const pkg of groupPackages(cwd, groupName)) {
    const current = pkg.packageJson.version
    if (named.has(pkg.name)) {
      packages.push(pkg.name)
      const version = bumped.get(pkg.name)
      itinerary.push(
        `• ${group.packages[pkg.name]}${version ? ` v${version}` : ''}`
      )
    } else if (!tagExists(`${pkg.name}@${current}`, cwd)) {
      packages.push(pkg.name)
      itinerary.push(`• ${group.packages[pkg.name]} v${current} (unpublished)`)
    }
  }

  return {
    release: String(packages.length > 0),
    packages: JSON.stringify(packages),
    itinerary: itinerary.join('\n'),
  }
}

function writeOutputs(outputs) {
  const lines = Object.entries(outputs).map(([key, value]) =>
    value.includes('\n') ? `${key}<<EOF\n${value}\nEOF` : `${key}=${value}`
  )
  const text = `${lines.join('\n')}\n`
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, text)
  } else {
    process.stdout.write(text)
  }
}

// `changeset version` consumes every changeset it can see, so the other groups'
// changesets are moved out of `.changeset/` while it runs and restored after.
async function version(cwd, groupName) {
  const changesets = await check(cwd)
  const parked = changesets.filter(
    (changeset) => !inGroup(changeset, groupName)
  )
  if (parked.length === changesets.length) {
    console.log(
      `No changesets release the "${groupName}" group; keeping the current versions`
    )
    return false
  }

  const parking = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-changesets-'))
  const moved = []
  try {
    for (const { id } of parked) {
      const from = path.join(cwd, '.changeset', `${id}.md`)
      const to = path.join(parking, `${id}.md`)
      fs.renameSync(from, to)
      moved.push([to, from])
    }
    run('pnpm', ['changeset', 'version'], { cwd })
    for (const { name, packageJson } of groupPackages(cwd, groupName)) {
      if (packageJson.scripts?.postVersion) {
        run('pnpm', ['--filter', name, 'run', 'postVersion'], { cwd })
      }
    }
    // The Python packages pin the workspace `e2b` in their uv.lock, so a bump
    // of one Python package has to be re-locked in every other one.
    for (const { dir } of workspacePackages(cwd).values()) {
      if (fs.existsSync(path.join(dir, 'uv.lock'))) {
        run('uv', ['lock'], { cwd: dir })
      }
    }
  } finally {
    for (const [to, from] of moved) fs.renameSync(to, from)
    fs.rmSync(parking, { recursive: true, force: true })
  }
  return true
}

function isPublished(name, version, cwd) {
  const result = capture(
    'npm',
    ['view', `${name}@${version}`, 'version', '--json'],
    { cwd }
  )
  if (result.status === 0) return true
  let error
  try {
    error = JSON.parse(result.stdout).error
  } catch {
    error = undefined
  }
  if (error?.code === 'E404') return false
  throw new Error(
    `Could not check whether ${name}@${version} is published:\n${result.stderr}`
  )
}

function tagExists(tag, cwd) {
  const result = capture(
    'git',
    ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`],
    { cwd }
  )
  if (result.status === 0) return true
  if (result.status === 2) return false
  throw new Error(`Could not look up tag ${tag}:\n${result.stderr}`)
}

function changelogEntry(dir, version) {
  const changelog = path.join(dir, 'CHANGELOG.md')
  if (!fs.existsSync(changelog)) return ''
  const lines = fs.readFileSync(changelog, 'utf8').split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return ''
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  if (end === -1) end = lines.length
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
}

function createRelease(pkg, tag, cwd) {
  const notes = changelogEntry(pkg.dir, pkg.packageJson.version)
  if (!notes) {
    console.warn(
      `::warning::No CHANGELOG.md entry for ${tag}; creating the GitHub release without notes`
    )
  }
  const notesFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-notes-')),
    'notes.md'
  )
  fs.writeFileSync(notesFile, notes)
  try {
    const args = [
      'release',
      'create',
      tag,
      '--title',
      tag,
      '--notes-file',
      notesFile,
    ]
    if (pkg.packageJson.version.includes('-')) args.push('--prerelease')
    run('gh', args, { cwd })
  } finally {
    fs.rmSync(path.dirname(notesFile), { recursive: true, force: true })
  }
}

function workspaceDependencies(pkg, packages) {
  const deps = {
    ...pkg.packageJson.dependencies,
    ...pkg.packageJson.optionalDependencies,
    ...pkg.packageJson.peerDependencies,
  }
  return Object.entries(deps)
    .filter(([, range]) => range.startsWith('workspace:'))
    .map(([name]) => {
      const dep = packages.get(name)
      if (!dep)
        throw new Error(
          `${pkg.name} depends on "${name}", which is not in the workspace`
        )
      return { name, ...dep }
    })
}

// Public packages go to npm with `pnpm publish`; private ones are Python
// packages whose `postPublish` uploads them to PyPI.
function publish(cwd, groupName) {
  const packages = workspacePackages(cwd)
  const members = groupPackages(cwd, groupName)
  const publicMembers = members.filter((pkg) => !pkg.packageJson.private)
  if (members.length > publicMembers.length && !process.env.PYPI_TOKEN) {
    throw new Error(
      `PYPI_TOKEN is not set, but the "${groupName}" group publishes to PyPI`
    )
  }

  // `pnpm publish` resolves `workspace:` ranges to the dependency's current
  // version, which consumers can only install once that version is on npm.
  const dependencies = new Map()
  for (const pkg of publicMembers) {
    for (const dep of workspaceDependencies(pkg, packages)) {
      dependencies.set(dep.name, dep)
      const { version } = dep.packageJson
      if (
        !members.some((member) => member.name === dep.name) &&
        !isPublished(dep.name, version, cwd)
      ) {
        throw new Error(
          `${pkg.name} depends on ${dep.name}@${version}, which is not published to npm; release the "${groupOf(dep.name)}" group first`
        )
      }
    }
  }
  for (const dep of dependencies.values()) {
    run('pnpm', ['--filter', dep.name, 'run', 'build'], { cwd })
  }

  for (const pkg of members) {
    const { version } = pkg.packageJson
    const tag = `${pkg.name}@${version}`

    if (tagExists(tag, cwd)) {
      console.log(`Skipping ${tag} (already released)`)
      continue
    }

    if (pkg.packageJson.private) {
      run('pnpm', ['--filter', pkg.name, 'run', 'postPublish'], { cwd })
    } else if (isPublished(pkg.name, version, cwd)) {
      console.log(`Skipping npm publish of ${tag} (already published)`)
    } else {
      run(
        'pnpm',
        ['publish', '--access', 'public', '--tag', 'latest', '--no-git-checks'],
        { cwd: pkg.dir }
      )
    }

    run('git', ['tag', tag, '-m', tag], { cwd })
    console.log(`New tag: ${tag}`)
    run('git', ['push', 'origin', tag], { cwd })
    createRelease(pkg, tag, cwd)
  }
}

async function main([command, ...args]) {
  const cwd = process.cwd()
  switch (command) {
    case 'check':
      await check(cwd)
      return
    case 'plan': {
      const [groupName, statusFile] = args
      if (!groupName || !statusFile) {
        throw new Error(
          'Usage: release.cjs plan <group> <changeset-status.json>'
        )
      }
      writeOutputs(await plan(cwd, groupName, statusFile))
      return
    }
    case 'version':
      if (!args[0]) throw new Error('Usage: release.cjs version <group>')
      writeOutputs({ versioned: String(await version(cwd, args[0])) })
      return
    case 'publish':
      if (!args[0]) throw new Error('Usage: release.cjs publish <group>')
      publish(cwd, args[0])
      return
    default:
      throw new Error(
        'Usage: release.cjs <check | plan <group> <status.json> | version <group> | publish <group>>'
      )
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`::error::${error.message}`)
    process.exit(1)
  })
}

module.exports = { groups, groupOf, check, plan, version, publish }
