#!/usr/bin/env node

import * as updateNotifier from 'update-notifier'

import { program } from './commands/index'

import * as packageJSON from '../package.json'

updateNotifier.default({ pkg: packageJSON }).notify()

program.version(packageJSON.version, undefined, 'Display e2b CLI version').parse()
