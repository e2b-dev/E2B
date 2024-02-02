import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { ensureAccessToken } from 'src/api'
import { listAliases } from '../utils/format'
import { sortTemplatesAliases } from 'src/utils/templateSort'

const listTemplates = e2b.withAccessToken(
  e2b.api.path('/templates').method('get').create(),
)

export const listCommand = new commander.Command('list')
  .description('List sandbox templates')
  .alias('ls')
  .action(async () => {
    try {
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      const templates = await listSandboxTemplates({ accessToken })

      for (const template of templates) {
        sortTemplatesAliases(template.aliases)
      }

      if (!templates?.length) {
        console.log('No templates found.')
      } else {
        const table = new tablePrinter.Table({
          title: 'Sandbox templates',
          columns: [
            { name: 'templateID', alignment: 'left', title: 'Template ID' },
            { name: 'aliases', alignment: 'left', title: 'Template Name', color: 'orange' },
          ],
          disabledColumns: ['public', 'buildID'],
          rows: templates.map((template) => ({ ...template, aliases: listAliases(template.aliases) })),
          colorMap: {
            orange: '\x1b[38;5;216m',
          },
        })
        table.printTable()

        process.stdout.write('\n')
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export async function listSandboxTemplates({
  accessToken,
}: { accessToken: string }): Promise<e2b.components['schemas']['Template'][]> {
  const templates = await listTemplates(accessToken, {})
  return templates.data
}
