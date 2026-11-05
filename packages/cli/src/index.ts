#!/usr/bin/env -S node --enable-source-maps

import simpleUpdateNotifier from 'simple-update-notifier'
import * as commander from 'commander'
import * as packageJSON from '../package.json'
import { program } from './commands'
import { commands2md } from './utils/commands2md'

export const pkg = packageJSON

// NO_UPDATE_NOTIFIER is the opt-out shared with `update-notifier`; distro
// packagers set it because "install the new version" doesn't apply there.
const updateCheck = process.env.NO_UPDATE_NOTIFIER
  ? Promise.resolve()
  : simpleUpdateNotifier({
      pkg,
      updateCheckInterval: 1000 * 60 * 60 * 8, // 8 hours
    }).catch((e) => {
      if (process.env.DEBUG) {
        console.error('Update check failed:', e)
      }
    })

const prog = program.version(
  packageJSON.version,
  undefined,
  'display E2B CLI version'
)

async function main() {
  // Used by the e2b-dev/docs reference generator. Checked by hand because
  // commander rejects multi-character short flags like `-cmd2md`.
  if (
    process.env.NODE_ENV === 'development' &&
    process.argv.includes('-cmd2md')
  ) {
    commands2md(program.commands as commander.Command[])
    process.exit(0)
  }

  await prog.parseAsync()
  await updateCheck
}

main()
