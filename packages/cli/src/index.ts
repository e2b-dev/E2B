#!/usr/bin/env node

import * as updateNotifier from 'update-notifier'

import * as packageJSON from '../package.json'
import { program } from './commands'
import { Option } from 'commander'
import * as stripAnsi from 'strip-ansi'

export const pkg = packageJSON

updateNotifier.default({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 8, // 8 hours
}).notify()

program
  .version(packageJSON.version, undefined, 'Display E2B CLI version')
  .addOption(new Option('-cmd2json').hideHelp()).on('option:-cmd2json', () => {
    process.stdout.write(JSON.stringify((program.commands.map((x: any) => ({
      command: x.name(),
      description: stripAnsi.default(x.description()),
      options: x.options.map((y: any) => ({
        flags: y.flags,
        description: stripAnsi.default(y.description),
        defaultValue: y.defaultValue,
      })),
    })).sort((row1: any, row2: any) => row1.name().localeCompare(row2.name())))));
    process.exit(0);
  }).parse();
