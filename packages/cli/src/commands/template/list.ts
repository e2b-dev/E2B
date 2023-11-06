import * as chalk from 'chalk'
import * as commander from 'commander'
import * as e2b from '@e2b/sdk'

import { ensureAccessToken } from 'src/api'

const listTemplates = e2b.withAccessToken(
  e2b.api.path('/envs').method('get').create(),
)

export const listCommand = new commander.Command('list')
  .description('List sandbox templates')
  .alias('ls')
  .action(async () => {
    try {
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      const templatesResponse = await listTemplates(accessToken, {})

      console.log(
        chalk.default.underline(chalk.default.green('Sandbox templates')),
      )

      const templates = templatesResponse.data

      if (!templates?.length) {
        console.log('No templates found.')
      } else {
        templates
          .sort((a, b) => a.envID.localeCompare(b.envID))
          .forEach((template: { envID: string }) => {
            console.log(template.envID)
          })
      }

      process.stdout.write('\n')
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
