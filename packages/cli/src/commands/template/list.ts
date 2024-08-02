import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { listAliases } from '../../utils/format'
import { sortTemplatesAliases } from 'src/utils/templateSort'
import { client, ensureAccessToken, ensureUserConfig } from 'src/api'
import { teamOption } from '../../options'

const listTemplates = e2b.withAccessToken(
  client.api.path('/templates').method('get').create(),
)

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .addOption(teamOption)
  .action(async (
    opts: {
      team: string
    },
  ) => {
    try {
      const userConfig = ensureUserConfig()
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      const templates = await listSandboxTemplates({
        accessToken: accessToken,
        teamID: opts.team || userConfig.teamId || userConfig.defaultTeamId! // default team ID is here for backwards compatibility
      })

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
            { name: 'cpuCount', alignment: 'right', title: 'vCPUs' },
            { name: 'memoryMB', alignment: 'right', title: 'RAM MiB' },
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
  accessToken, teamID
}: { accessToken: string, teamID: string }): Promise<e2b.components['schemas']['Template'][]> {
  const templates = await listTemplates(accessToken, {teamID})
  return templates.data
}
