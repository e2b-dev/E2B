import * as e2b from 'e2b'
import * as chalk from 'chalk'

import { asFormattedSandboxTemplate } from 'src/utils/format'

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
