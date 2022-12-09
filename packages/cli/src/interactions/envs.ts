import * as sdk from '@devbookhq/sdk'
import * as chalk from 'chalk'
import * as fs from 'fs'

import { getConfigPath, loadConfig } from 'src/config'
import { sortEnvs } from 'src/utils/sort'
import { formatEnvironment } from 'src/utils/format'

export async function getPromptEnv(envs: sdk.components['schemas']['Environment'][]) {
  const inquirer = await import('inquirer')
  const envsAnwsers = await inquirer.default.prompt([
    {
      name: 'env',
      message: chalk.default.underline('Select an environment'),
      type: 'list',
      pageSize: 50,
      choices: envs.sort(sortEnvs).map(e => ({
        name: formatEnvironment(e),
        value: e,
      })),
    },
  ])

  return envsAnwsers['env'] as sdk.components['schemas']['Environment']
}

export async function getPromptEnvs(envs: sdk.components['schemas']['Environment'][]) {
  const inquirer = await import('inquirer')
  const envsAnwsers = await inquirer.default.prompt([
    {
      name: 'envs',
      message: chalk.default.underline('Select environments'),
      type: 'checkbox',
      pageSize: 50,
      choices: envs.sort(sortEnvs).map(e => ({
        name: formatEnvironment(e),
        value: e,
      })),
    },
  ])

  return envsAnwsers['envs'] as sdk.components['schemas']['Environment'][]
}

export async function getRootEnv(root: string) {
  const configPath = getConfigPath(root)

  if (fs.existsSync(configPath)) {
    return loadConfig(configPath)
  }
}
