#!/usr/bin/env node

import * as updateNotifier from 'update-notifier'

import * as packageJSON from '../package.json'
import { program } from './commands'

export const pkg = packageJSON

updateNotifier.default({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 8, // 8 hours
}).notify()

program
  .version(packageJSON.version, undefined, 'Display E2B CLI version')
  .parse()
