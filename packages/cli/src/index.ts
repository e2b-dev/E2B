#!/usr/bin/env -S node --enable-source-maps

import simpleUpdateNotifier from 'simple-update-notifier'
import * as packageJSON from '../package.json'
import { program } from './commands'

const pkg = packageJSON

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
  await prog.parseAsync()
  await updateCheck
}

main()
