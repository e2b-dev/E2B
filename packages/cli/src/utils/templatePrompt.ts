import * as e2b from 'e2b'
import * as chalk from 'chalk'

import { asFormattedSandboxTemplate } from 'src/utils/format'

export async function getPromptTemplates(
  templates: e2b.components['schemas']['Template'][],
  text: string
) {
  const inquirer = await import('inquirer')
  const templatesAnswers = await inquirer.default.prompt([
    {
      name: 'templates',
      message: chalk.default.underline(text),
      type: 'checkbox',
      pageSize: 50,
      choices: templates.map((e) => ({
        name: asFormattedSandboxTemplate(e),
        value: e,
      })),
    },
  ])

  return templatesAnswers[
    'templates'
  ] as e2b.components['schemas']['Template'][]
}
