import * as commander from 'commander'
import * as e2b from 'e2b'

import { listAliases } from '../../utils/format'
import { printTable, type TableColumn } from 'src/utils/table'
import { sortTemplatesAliases } from 'src/utils/templateSort'
import { client, ensureAPIKey, resolveTeamId } from 'src/api'
import { teamOption } from '../../options'
import { handleE2BRequestError } from '../../utils/errors'

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .addOption(teamOption)
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (opts: { team: string; format: string }) => {
    try {
      const format = opts.format || 'pretty'
      ensureAPIKey()
      process.stdout.write('\n')

      const templates = await listSandboxTemplates({
        teamID: resolveTeamId(opts.team),
      })

      for (const template of templates) {
        sortTemplatesAliases(template.aliases)
      }

      if (format === 'pretty') {
        renderTable(templates)
      } else if (format === 'json') {
        console.log(JSON.stringify(templates, null, 2))
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function renderTable(templates: e2b.components['schemas']['Template'][]) {
  if (!templates?.length) {
    console.log('No templates found.')
    return
  }

  const columns: TableColumn<e2b.components['schemas']['Template']>[] = [
    {
      name: 'visibility',
      title: 'Access',
      getValue: (template) => (template.public ? 'Public' : 'Private'),
    },
    { name: 'templateID', title: 'Template ID' },
    {
      name: 'aliases',
      title: 'Template Name',
      maxLen: 20,
      getValue: (template) => listAliases(template.aliases),
    },
    { name: 'cpuCount', title: 'vCPUs', alignment: 'right' },
    { name: 'memoryMB', title: 'RAM MiB', alignment: 'right' },
    {
      name: 'createdBy',
      title: 'Created by',
      alignment: 'right',
      getValue: (template) => template.createdBy?.email,
    },
    {
      name: 'createdAt',
      title: 'Created at',
      alignment: 'right',
      getValue: (template) => new Date(template.createdAt).toLocaleDateString(),
    },
    { name: 'diskSizeMB', title: 'Disk size MiB', alignment: 'right' },
    { name: 'envdVersion', title: 'Envd version', alignment: 'right' },
  ]

  printTable(columns, templates)

  process.stdout.write('\n')
}

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
