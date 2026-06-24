import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { listAliases } from '../../utils/format'
import { sortTemplatesAliases } from 'src/utils/templateSort'
import { ensureAPIKey, resolveTeamId } from 'src/api'
import { teamOption } from '../../options'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .addOption(teamOption)
  .option(
    '-l, --limit <limit>',
    `limit the number of templates returned (default: ${DEFAULT_LIMIT}, 0 for no limit)`,
    (value) => parseInt(value)
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (opts: { team: string; format: string; limit?: number }) => {
    try {
      const format = opts.format || 'pretty'
      const limit = opts.limit === 0 ? undefined : (opts.limit ?? DEFAULT_LIMIT)
      ensureAPIKey()
      process.stdout.write('\n')

      const { templates, hasMore } = await listSandboxTemplates({
        teamID: resolveTeamId(opts.team),
        limit,
      })

      for (const template of templates) {
        sortTemplatesAliases(template.aliases)
      }

      if (format === 'pretty') {
        renderTable(templates)
        if (hasMore) {
          console.log(
            `Showing first ${limit} templates. Use --limit to change.`
          )
        }
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
      { name: 'diskSizeMB', alignment: 'right', title: 'Disk size MiB' },
      { name: 'envdVersion', alignment: 'right', title: 'Envd version' },
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

type ListSandboxTemplatesResult = {
  templates: e2b.components['schemas']['Template'][]
  hasMore: boolean
}

export async function listSandboxTemplates({
  teamID,
  limit,
}: {
  teamID?: string
  limit?: number
}): Promise<ListSandboxTemplatesResult> {
  // Resolve the API key here (env var or ~/.e2b/config.json) and pass it to the
  // SDK paginator. The paginator builds its own ConnectionConfig, so without
  // this the config-file login (`e2b auth login`) would be treated as
  // unauthenticated. This also covers the delete/publish select flows.
  const apiKey = ensureAPIKey()

  let pageLimit = limit
  if (!limit || limit > PAGE_LIMIT) {
    pageLimit = PAGE_LIMIT
  }

  const paginator = e2b.Template.list({
    apiKey,
    teamId: teamID,
    limit: pageLimit,
  })

  const templates: e2b.components['schemas']['Template'][] = []
  while (paginator.hasNext && (!limit || templates.length < limit)) {
    const batch = await paginator.nextItems()
    templates.push(...batch.map(toTemplateSchema))
  }

  return {
    templates: limit ? templates.slice(0, limit) : templates,
    // We can't change the page size during iteration, so we may have to check
    // if we have more templates than the limit.
    hasMore: paginator.hasNext || (limit ? templates.length > limit : false),
  }
}

// Adapt the SDK's TemplateInfo back to the raw API schema shape the rest of the
// CLI (table rendering, selection prompts, `--format json`) is built around.
function toTemplateSchema(
  template: e2b.TemplateInfo
): e2b.components['schemas']['Template'] {
  return {
    templateID: template.templateId,
    buildID: template.buildId,
    cpuCount: template.cpuCount,
    memoryMB: template.memoryMB,
    diskSizeMB: template.diskSizeMB,
    public: template.public,
    aliases: template.aliases,
    names: template.names,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    lastSpawnedAt: template.lastSpawnedAt
      ? template.lastSpawnedAt.toISOString()
      : null,
    spawnCount: template.spawnCount,
    buildCount: template.buildCount,
    envdVersion: template.envdVersion,
    createdBy: template.createdBy,
    buildStatus: template.buildStatus,
  }
}
