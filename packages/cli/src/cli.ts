#!/usr/bin/env node

import { program } from 'commander'
import { Session } from '@devbookhq/sdk'

program
  .command('create <configPaths...>')
  .option('-l, --local', '', false)
  .action(async (configPaths, cmdObj) => {

  })

program.parse(process.argv)
