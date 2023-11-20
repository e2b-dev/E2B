import * as e2b from '@e2b/sdk'
import * as chalk from 'chalk'

import { asFormattedSandboxTemplate } from 'src/utils/format'

export async function getPromptEnv(
  envs: e2b.components['schemas']['Environment'][],
  text: string,
) {
  const inquirer = await import('inquirer')
  const envsAnwsers = await inquirer.default.prompt([
    {
      name: 'env',
      message: chalk.default.underline(text),
      type: 'list',
      pageSize: 50,
      choices: envs.map(e => ({
        name: asFormattedSandboxTemplate(e),
        value: e,
      })),
    },
  ])

  return envsAnwsers['env'] as e2b.components['schemas']['Environment']
}

export async function getPromptEnvs(
  envs: e2b.components['schemas']['Environment'][],
  text: string,
) {
  const inquirer = await import('inquirer')
  const envsAnwsers = await inquirer.default.prompt([
    {
      name: 'envs',
      message: chalk.default.underline(text),
      type: 'checkbox',
      pageSize: 50,
      choices: envs.map(e => ({
        name: asFormattedSandboxTemplate(e),
        value: e,
      })),
    },
  ])

  return envsAnwsers['envs'] as e2b.components['schemas']['Environment'][]
}
