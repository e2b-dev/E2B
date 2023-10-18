#!/usr/bin/env node

import * as updateNotifier from 'update-notifier'

import * as packageJSON from '../package.json'
import { program } from './commands/index'

export const pkg = packageJSON

updateNotifier.default({ pkg }).notify()

program.version(packageJSON.version, undefined, 'Display e2b CLI version').parse()