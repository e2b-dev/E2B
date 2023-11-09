import * as chalk from 'chalk'
import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from '@e2b/sdk'

import { ensureAccessToken } from 'src/api'
import { listAliases } from '../../utils/format'

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
        const table = new tablePrinter.Table({
          title: 'Sandbox templates',
          columns: [
            { name: 'envID', alignment: 'left', title: 'EnvID' },
            { name: 'aliases', alignment: 'left', title: 'Name', color: 'blue' },
          ],
          disabledColumns: ['public', 'buildID'],
          rows: templates.map((template) => ({ ...template, aliases: listAliases(template.aliases) })),
          sort: (row1, row2) => row1.envID.localeCompare(row2.envID),
        })
        table.printTable()

        process.stdout.write('\n')
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
