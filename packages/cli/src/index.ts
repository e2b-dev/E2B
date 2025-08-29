#!/usr/bin/env -S node --enable-source-maps

import updateNotifier from 'update-notifier'
import * as commander from 'commander'
import * as packageJSON from '../package.json'
import { program } from './commands'
import { commands2md } from './utils/commands2md'

export const pkg = packageJSON

updateNotifier({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 8, // 8 hours
}).notify()

const prog = program.version(
  packageJSON.version,
  undefined,
  'display E2B CLI version'
)

if (process.env.NODE_ENV === 'development') {
  prog
    .addOption(new commander.Option('-cmd2md').hideHelp())
    .on('option:-cmd2md', () => {
      commands2md(program.commands as any)
      process.exit(0)
    })
}

prog.parse()
