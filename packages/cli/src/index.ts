#!/usr/bin/env node
import * as updateNotifier from 'update-notifier'

import * as packageJSON from '../package.json'
import { program } from './commands/index'

updateNotifier.default({ pkg: packageJSON }).notify()

program.version(packageJSON.version, undefined, 'Display e2b CLI version').parse()
