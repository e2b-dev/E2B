#!/usr/bin/env node

import * as updateNotifier from 'update-notifier'

import * as packageJSON from '../package.json'
import { program } from './commands'

export const pkg = packageJSON

updateNotifier.default({ pkg }).notify()

program
  .version(packageJSON.version, undefined, 'Display E2B CLI version')
  .parse()
