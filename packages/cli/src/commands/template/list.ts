import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { listAliases } from '../../utils/format'
import { sortTemplatesAliases } from 'src/utils/templateSort'
import { client, ensureAccessToken, ensureUserConfig } from 'src/api'
import { teamOption } from '../../options'
import { handleE2BRequestError } from '../../utils/errors'

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .addOption(teamOption)
  .action(async (opts: { team: string }) => {
    try {
      const userConfig = ensureUserConfig()
      ensureAccessToken()
      process.stdout.write('\n')

      const templates = await listSandboxTemplates({
        teamID: opts.team || userConfig.teamId || userConfig.defaultTeamId!, // default team ID is here for backwards compatibility)
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
            { name: 'visibility', alignment: 'left', title: 'Access' },
            { name: 'templateID', alignment: 'left', title: 'Template ID' },
            {
              name: 'aliases',
              alignment: 'left',
              title: 'Template Name',
              color: 'orange',
              maxLen: 20,
            },
            { name: 'cpuCount', alignment: 'right', title: 'vCPUs' },
            { name: 'memoryMB', alignment: 'right', title: 'RAM MiB' },
            { name: 'createdBy', alignment: 'right', title: 'Created by' },
            { name: 'createdAt', alignment: 'right', title: 'Created at' },
          ],
          disabledColumns: [
            'public',
            'buildID',
            'buildCount',
            'lastSpawnedAt',
            'spawnCount',
            'updatedAt',
          ],
          rows: templates.map((template) => ({
            ...template,
            visibility: template.public ? 'Public' : 'Private',
            aliases: listAliases(template.aliases),
            createdBy: template.createdBy?.email,
            createdAt: new Date(template.createdAt).toLocaleDateString(),
          })),
          style: {
            headerTop: {
              left: '',
              right: '',
              mid: '',
              other: '',
            },
            headerBottom: {
              left: '',
              right: '',
              mid: '',
              other: '',
            },
            tableBottom: {
              left: '',
              right: '',
              mid: '',
              other: '',
            },
            vertical: '',
          },
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
  teamID,
}: {
  teamID?: string
}): Promise<e2b.components['schemas']['Template'][]> {
  const templates = await client.api.GET('/templates', {
    params: {
      query: { teamID },
    },
  })

  handleE2BRequestError(templates, 'Error getting templates')
  return templates.data
}
