#!/usr/bin/env node

import { program } from 'commander'
import updateNotifier from 'update-notifier'
import inquirer from 'inquirer'
import chalk from 'chalk'

import { getAPIKey } from './auth'
import { configName, loadConfig } from './config'
import { initEnvironment } from './env/init'
import { listEnvironments } from './env/list'
import { useEnvironment } from './env/use'
import { deleteEnvironment } from './env/delete'
import { publishEnvironment } from './env/publish'
import { pushEnvironment } from './env/push'

import packageJSON from '../package.json'

const apiKey = getAPIKey()

program.description('A tool for interacting with Devbook from command line or CI/CD')
program.version(packageJSON.version, undefined, 'Displays the version of Devbook CLI')

updateNotifier({ pkg: packageJSON }).notify()

const env = program
  .command('env')
  .description(
    'A command for managing Devbook environments and their configs in repositories',
  )

env
  .command('init')
  .description(
    'Initialize a new environment based on a template. The environment must be published before it is publicly available',
  )
  .requiredOption(
    '-t, --template <template>',
    'Template to use as a base for the environment',
    undefined,
  )
  .action(async cmdObj => {
    try {
      if (!apiKey) process.exit(1)

      const template = cmdObj.template as string

      const envRootPath = process.cwd()

      console.log(
        `Initializing a new environment with "${template}" template in the "${envRootPath}" directory...`,
      )

      const config = await initEnvironment({
        template,
        apiKey,
        envRootPath,
      })

      console.log(
        `Done - Initialized a new environment with ID "${config.id}" and with config "${configName}" in the "${envRootPath}" directory.`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('list')
  .description('List all available environments')
  .action(async () => {
    try {
      if (!apiKey) process.exit(1)

      console.log('Listing all available environments ...')

      const envs = await listEnvironments({ apiKey })

      if (envs.length === 0) {
        console.log('No envs available')
        return
      }

      console.log(chalk.bgGreen('Environments\n'))
      envs.forEach(e =>
        console.log(
          `- ${chalk.bold(e.id)} (${
            e.state === 'Failed' ? chalk.red(e.state) : e.state
          })`,
        ),
      )

      console.log('Done - Listed all available environments')
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('use')
  .argument('[id]', 'ID of the environment that you want to recreate the config for')
  .description('Recreate config for an existing environment')
  .action(async id => {
    try {
      if (!apiKey) process.exit(1)

      let envID: string
      const envRootPath = process.cwd()

      if (!id) {
        const envs = await listEnvironments({ apiKey })

        if (envs.length === 0) {
          console.log('No envs available')
          return
        }

        const envsAnwsers = await inquirer.prompt([
          {
            name: 'envID',
            message: 'Select an environment to use:',
            type: 'list',
            pageSize: 50,
            choices: envs.map(e => ({
              name: `${e}`,
              value: e,
            })),
          },
        ])

        envID = envsAnwsers['envID'] as string

        if (!envID) {
          throw new Error('Cannot find docset."')
        }
      } else {
        envID = id as string
      }

      console.log(
        `Recreating config for the environment "${envID}" in the "${envRootPath}" directory...`,
      )

      const config = await useEnvironment({
        apiKey,
        envRootPath,
        id: envID,
      })

      console.log(
        `Done - Recreated config "${configName}" for an existing environment with id "${config.id}" in the "${envRootPath}" directory.`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('push')
  .description(
    `Push environment based on the "${configName}" config in the current directory`,
  )
  .action(async () => {
    try {
      if (!apiKey) process.exit(1)

      const envRootPath = process.cwd()

      console.log(`Pushing environment in the "${envRootPath}" directory...`)

      const config = await pushEnvironment({ apiKey, envRootPath })

      console.log(
        `Done - Pushed environment with id "${config.id}" in the "${envRootPath}" directory according to the config "${configName}".`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('publish')
  .argument(
    '[id]',
    `ID of the environment that you want to publish. If it is not specified the environment id from the "${configName}" in the current directory will be used`,
  )
  .description('Make the latest version of an environment publicly available')
  .action(async id => {
    try {
      if (!apiKey) process.exit(1)

      let envID: string

      if (!id) {
        const envRootPath = process.cwd()
        const config = await loadConfig(envRootPath)
        console.log(
          `Publishing environment with ID "${id}" in the "${envRootPath}" directory...`,
        )
        envID = config.id
      } else {
        envID = id as string
        console.log(`Publishing environment with ID "${id}"...`)
      }

      const confirmAnswers = await inquirer.prompt([
        {
          name: 'confirm',
          type: 'confirm',
          default: false,
          message: `Do you really want to publish environment with ID "${envID}"?`,
        },
      ])

      const confirm = confirmAnswers['confirm'] as string | undefined

      if (!confirm) {
        console.log(`Aborting publishing of the environment with ID "${envID}"`)
        return
      }

      await publishEnvironment({ apiKey, id: envID })

      console.log(
        `Done - Published environment with id "${envID}" - the last version of the environment is now PUBLICLY ACCESSIBLE.`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('delete')
  .argument(
    '[id]',
    `ID of the environment that you want to delete. If it is not specified the environment id from the "${configName}" in the current directory will be used`,
  )
  .description('Delete an environment')
  .action(async id => {
    try {
      if (!apiKey) process.exit(1)

      let envID: string

      if (!id) {
        const envRootPath = process.cwd()
        const config = await loadConfig(envRootPath)
        envID = config.id
        console.log(
          `Deleting environment with ID "${id}" in the "${envRootPath}" directory...`,
        )
      } else {
        envID = id as string
        console.log(`Deleting environment with ID "${id}" directory...`)
      }

      const confirmAnswers = await inquirer.prompt([
        {
          name: 'confirm',
          type: 'confirm',
          default: false,
          message: `Do you really want to delete environment with ID "${envID}"?`,
        },
      ])

      const confirm = confirmAnswers['confirm'] as string | undefined

      if (!confirm) {
        console.log(`Aborting deleting of the environment with ID "${envID}"`)
        return
      }

      await deleteEnvironment({ apiKey, id: envID })

      console.log(
        `Done - Deleted environment with id "${envID}" - you now should delete all "${configName}" config files for this environment (with "id = "${envID}" inside of the config).`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

program.parse(process.argv)
