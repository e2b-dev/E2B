import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { listAliases } from '../../utils/format'
import { sortTemplatesAliases } from 'src/utils/templateSort'
import { ensureAPIKey } from 'src/api'

const DEFAULT_LIMIT = 0
const PAGE_LIMIT = 100

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .option(
    '-l, --limit <limit>',
    `limit the number of templates returned (default: ${DEFAULT_LIMIT}, 0 for no limit)`,
    (value) => parseInt(value),
    DEFAULT_LIMIT
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (opts: { format: string; limit: number }) => {
    try {
      const format = opts.format || 'pretty'
      // 0 (the default) means no limit — return the whole list.
      const limit = opts.limit || undefined
      ensureAPIKey()
      process.stdout.write('\n')

      const templates = await listSandboxTemplates({ limit })

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

export async function listSandboxTemplates({
  limit,
}: {
  limit?: number
} = {}): Promise<e2b.components['schemas']['Template'][]> {
  // Resolve the API key here (env var or ~/.e2b/config.json) and pass it to the
  // SDK paginator. The paginator builds its own ConnectionConfig, so without
  // this the config-file login (`e2b auth login`) would be treated as
  // unauthenticated. This also covers the delete/publish select flows.
  // The API key is team-scoped, so listing never needs a team identifier.
  const apiKey = ensureAPIKey()

  let pageLimit = limit
  if (!limit || limit > PAGE_LIMIT) {
    pageLimit = PAGE_LIMIT
  }

  const templates: e2b.components['schemas']['Template'][] = []
  const paginator = e2b.Template.list({ apiKey, limit: pageLimit })

  while (paginator.hasNext && (!limit || templates.length < limit)) {
    const batch = await paginator.nextItems()
    templates.push(...batch.map(toTemplateSchema))
  }

  return limit ? templates.slice(0, limit) : templates
}

// Adapt the SDK's TemplateInfo back to the raw API schema shape the rest of the
// CLI (table rendering, selection prompts, `--format json`) is built around.
function toTemplateSchema({
  templateId,
  buildId,
  createdAt,
  updatedAt,
  lastSpawnedAt,
  ...rest
}: e2b.TemplateInfo): e2b.components['schemas']['Template'] {
  return {
    ...rest,
    templateID: templateId,
    buildID: buildId,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    lastSpawnedAt: lastSpawnedAt ? lastSpawnedAt.toISOString() : null,
  }
}
