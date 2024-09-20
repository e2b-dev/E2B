#!/usr/bin/env -S node --enable-source-maps

import * as updateNotifier from 'update-notifier'

import * as commander from 'commander'
import * as packageJSON from '../package.json'
import { program } from './commands'
import { commands2md } from './utils/commands2md'
import { parse } from 'path'

export const pkg = packageJSON

updateNotifier
  .default({
    pkg,
    updateCheckInterval: 1000 * 60 * 60 * 8, // 8 hours
  })
  .notify()

program
  .version(packageJSON.version, undefined, 'display E2B CLI version')
  .addOption(new commander.Option('-cmd2md').hideHelp())
  .on('option:-cmd2md', () => {
    commands2md(program.commands as any)
    process.exit(0)
  })
  .parse()
