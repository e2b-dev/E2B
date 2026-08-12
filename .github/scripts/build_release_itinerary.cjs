#!/usr/bin/env node

// This script formats the JSON written by `changeset status --output=<file>`
// as the package list that goes into the release's Slack notifications.

const path = require('path')

// Packages are listed in this order; anything not named here still shows up,
// under its workspace name, after the ones that are.
const labels = {
  e2b: 'JS SDK (e2b)',
  '@e2b/python-sdk': 'Python SDK (e2b)',
  '@e2b/cli': 'CLI (@e2b/cli)',
}

const statusFile = process.argv[2]
if (!statusFile) {
  console.error('Usage: build_release_itinerary.cjs <changeset-status.json>')
  process.exit(1)
}

const order = Object.keys(labels)
const rank = (release) => {
  const index = order.indexOf(release.name)
  return index === -1 ? order.length : index
}

const { releases } = require(path.resolve(statusFile))
const lines = [...releases]
  .sort((a, b) => rank(a) - rank(b))
  .map(
    (release) =>
      `• ${labels[release.name] ?? release.name} v${release.newVersion}`
  )

process.stdout.write(lines.join('\n') || '• No packages were published')
