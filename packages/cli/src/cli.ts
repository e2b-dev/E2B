#!/usr/bin/env node

import * as commander from 'commander'
import * as inquirer from 'inquirer'
import * as chalk from 'chalk'
import * as fs from 'fs/promises'
import * as path from 'path'

import { getAPIKey } from './auth'
import { configName, getEnvRootPath, getNestedConfigs, loadConfig } from './config'
import { initEnvironment } from './env/init'
import { listEnvironments } from './env/list'
import { useEnvironment } from './env/use'
import { deleteEnvironment } from './env/delete'
import { publishEnvironment } from './env/publish'
import { pushEnvironment } from './env/push'

import * as packageJSON from '../package.json'

const apiKey = getAPIKey()

const program = commander.program

program.description('A tool for interacting with Devbook from command line or CI/CD')
program.version(packageJSON.version, undefined, 'Displays the version of Devbook CLI')

const env = program
  .command('env')
  .description('A command for managing Devbook environments and their configs')

env
  .command('init')
  .description(
    `Initialize a new environment based on a template and create a "${configName}" config for it in the filesystem. The environment must be published with the "env publish" command, before it is publicly available`,
  )
  .argument(
    '[envPath]',
    'Directory where the environment should be initialized. If it is not specified the environemnt will be initialize in the current directory',
  )
  .requiredOption(
    '-t, --template <template>',
    'Template to use as a base for the environment',
  )
  .action(async (envPath, cmdObj) => {
    try {
      if (!apiKey) process.exit(1)
      const template = cmdObj.template as string

      const envRootPath = getEnvRootPath(envPath)
      await fs.mkdir(envRootPath)

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
  .description('List available environments')
  .option(
    '-l, --local [dirPath]',
    'List only environments that are initialized in the current directory or in the specified "dirPath" directory and all nested directories.',
  )
  .action(async cmdObj => {
    try {
      if (!apiKey) process.exit(1)

      if (cmdObj.local === undefined) {
        console.log('Listing available environments ...')

        const envs = await listEnvironments({ apiKey })

        if (envs.length === 0) {
          console.log('No environments available')
          return
        }

        console.log(chalk.default.bgGreen('Environments\n'))
        envs.forEach(e =>
          console.log(
            `- ${chalk.default.bold(e.id)} (${
              e.state === 'Failed' ? chalk.default.red(e.state) : e.state
            })`,
          ),
        )
        console.log('Done - Listed available environments')
      } else {
        const dirPath = getEnvRootPath(cmdObj.local === true ? undefined : cmdObj.local)
        console.log(`Listing available local environments from "${dirPath}"...`)

        const configPaths = await getNestedConfigs(dirPath)

        const configs = await Promise.allSettled(
          configPaths.map(async c => {
            return await loadConfig(path.dirname(c.path))
          }),
        )

        console.log(chalk.default.bgGreen('Local environments\n'))
        for (let i = 0; i < configPaths.length; i++) {
          const configPath = configPaths[i]
          const config = configs[i]

          if (config.status === 'rejected') {
            console.log(
              chalk.default.red(
                `- cannot access or validate config "${configPath.path}"`,
              ),
            )
          } else {
            console.log(`- ${chalk.default.bold(config.value.id)} [${configPath.path}]`)
          }
        }

        console.log('Done - Listed available local environments')
      }
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('use')
  .description(
    `Reinitialize an existing environment, creating "${configName}" config for the environment in the filesystem`,
  )
  .argument(
    '[envPath]',
    'Directory where the environment should be reinitialized. If it is not specified the environemnt will be reinitialized in the current directory',
  )
  .option('--id <id>', 'ID of the environment that you want to reinitialize')
  .action(async (envPath, cmdObj) => {
    try {
      if (!apiKey) process.exit(1)
      let envID: string

      const envRootPath = getEnvRootPath(envPath)
      await fs.mkdir(envRootPath)

      if (cmdObj.id) {
        envID = cmdObj.id as string
      } else {
        const envs = await listEnvironments({ apiKey })

        if (envs.length === 0) {
          console.log('No environments available')
          return
        }

        const envsAnwsers = await inquirer.default.prompt([
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
      }

      console.log(
        `Reinitializing config for the environment "${envID}" in the "${envRootPath}" directory...`,
      )

      const config = await useEnvironment({
        apiKey,
        envRootPath,
        id: envID,
      })

      console.log(
        `Done - Reinitialized config "${configName}" for an existing environment with ID "${config.id}" in the "${envRootPath}" directory.`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('push')
  .description(
    `Upload environment files and update environment setup based on the "${configName}" config`,
  )
  .argument(
    '[envPath]',
    'Directory with the environment to push. If it is not specified the environemnt in the current directory will be pushed',
  )
  .option(
    '-a, --all',
    'Find all nested environments from the current directory or directory specified by the "envPath" argument and publish them',
  )
  .action(async (envPath, cmdObj) => {
    try {
      if (!apiKey) process.exit(1)
      const envRootPath = getEnvRootPath(envPath)

      const configPaths = cmdObj.all
        ? (await getNestedConfigs(envRootPath)).map(p => path.dirname(p.path))
        : [envRootPath]

      const configs = await Promise.all(
        configPaths.map(async configPath => {
          const config = await loadConfig(configPath)
          console.log(
            `Found environment with ID "${config.id}" in the "${configPath}" directory...`,
          )
          return config
        }),
      )

      await Promise.all(
        configs.map(async config => {
          process.stdout.write(
            `Pushing environment "${config.id}" from the "${envRootPath}" directory...`,
          )
          await pushEnvironment({ apiKey, envRootPath, config })
          console.log('done')
        }),
      )

      console.log(
        `Done - Pushed ${configPaths.length} ${
          configPaths.length === 1 ? 'environment' : 'environments'
        }`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('publish')
  .description('Make the latest version of an environment publicly available')
  .argument(
    '[envPath]',
    'Directory with the environment to publish. If it is not specified the environemnt in the current directory will be published',
  )
  .option(
    '--id <id>',
    'ID of the environment that you want to publish. If it is not specified the environment from current directory or from the directory specified by the "envPath" argument will be published',
  )
  .option(
    '-a, --all',
    'Find all nested environments from the current directory or directory specified by the "envPath" argument and publish them',
  )
  .action(async (envPath, cmdObj) => {
    try {
      if (!apiKey) process.exit(1)
      const envIDs: string[] = []

      if (cmdObj.id) {
        envIDs.push(cmdObj.id)
      } else {
        const envRootPath = getEnvRootPath(envPath)

        // TODO: Allow interactive select

        const configPaths = cmdObj.all
          ? (await getNestedConfigs(envRootPath)).map(p => path.dirname(p.path))
          : [envRootPath]

        const ids = await Promise.all(
          configPaths.map(async configPath => {
            const config = await loadConfig(configPath)
            console.log(
              `Found environment with ID "${config.id}" in the "${configPath}" directory...`,
            )
            return config.id
          }),
        )

        envIDs.push(...ids)
      }

      const confirmAnswers = await inquirer.default.prompt([
        {
          name: 'confirm',
          type: 'confirm',
          default: false,
          message: `Do you really want to publish the ${
            envIDs.length === 0 ? 'environment' : 'environments'
          }?`,
        },
      ])

      const confirm = confirmAnswers['confirm'] as string | undefined

      if (!confirm) {
        console.log(
          `Aborting publishing ${envIDs.length === 0 ? 'environment' : 'environments'}"`,
        )
        return
      }

      await Promise.all(
        envIDs.map(async id => {
          process.stdout.write(`Publishing environment "${id}"...`)
          await publishEnvironment({ apiKey, id })
          console.log('done')
        }),
      )

      console.log(
        `Done - Published ${envIDs.length} ${
          envIDs.length === 1 ? 'environment' : 'environments'
        }`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

env
  .command('delete')
  .description('Delete an environment')
  .argument(
    '[envPath]',
    'Directory with the environment to delete. If it is not specified the environemnt in the current directory will be deleted',
  )
  .option(
    '--id <id>',
    'ID of the environment that you want to delete. If it is not specified the environment from current directory or from the directory specified by the "envPath" argument will be deleted',
  )
  .action(async (envPath, cmdObj) => {
    try {
      if (!apiKey) process.exit(1)
      let envID: string

      if (cmdObj.id) {
        envID = cmdObj as string
        console.log(`Deleting environment with ID "${envID}" directory...`)
      } else {
        const envRootPath = getEnvRootPath(envPath)

        // TODO: Allow interactive selection if no env in the current dir
        const config = await loadConfig(envRootPath)
        envID = config.id
        console.log(
          `Deleting environment with ID "${envID}" in the "${envRootPath}" directory...`,
        )
      }

      const confirmAnswers = await inquirer.default.prompt([
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
