import * as commander from 'commander'
import * as e2b from 'e2b'

import { listAliases } from '../../utils/format'
import { renderTable } from 'src/utils/table'
import { sortTemplatesAliases } from 'src/utils/templateSort'
import { client, ensureAPIKey, resolveProjectId } from 'src/api'
import {
  deprecatedTeamOption,
  projectIdFromOptions,
  projectOption,
} from '../../options'
import { handleE2BRequestError } from '../../utils/errors'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

type ListOptions = {
  project?: string
  team?: string
  limit?: number
  format: string
}

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .option(
    '-l, --limit <limit>',
    `limit the number of templates returned (default: ${DEFAULT_LIMIT}, 0 for no limit)`,
    (value) => parseInt(value)
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (opts: ListOptions) => {
    try {
      const format = opts.format || 'pretty'
      const limit = opts.limit === 0 ? undefined : (opts.limit ?? DEFAULT_LIMIT)
      ensureAPIKey()
      process.stdout.write('\n')

      const { templates, hasMore } = await listSandboxTemplates({
        projectId: resolveProjectId(projectIdFromOptions(opts)),
        limit,
      })

      for (const template of templates) {
        sortTemplatesAliases(template.aliases)
      }

      if (format === 'pretty') {
        renderTemplateTable(templates)
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

function renderTemplateTable(
  templates: e2b.components['schemas']['Template'][]
) {
  if (!templates?.length) {
    console.log('No templates found.')
    return
  }

  renderTable(templates, [
    {
      header: 'Access',
      value: (template) => (template.public ? 'Public' : 'Private'),
    },
    { header: 'Template ID', value: (template) => template.templateID },
    {
      header: 'Template Name',
      value: (template) => listAliases(template.aliases),
    },
    { header: 'vCPUs', value: (template) => String(template.cpuCount) },
    { header: 'RAM MiB', value: (template) => String(template.memoryMB) },
    {
      header: 'Created by',
      value: (template) => template.createdBy?.email,
    },
    {
      header: 'Created at',
      value: (template) => new Date(template.createdAt).toLocaleDateString(),
    },
    {
      header: 'Disk size MiB',
      value: (template) => String(template.diskSizeMB),
    },
    { header: 'Envd version', value: (template) => template.envdVersion },
  ])
}

type ListSandboxTemplatesResult = {
  templates: e2b.components['schemas']['Template'][]
  hasMore: boolean
}

async function listSandboxTemplates({
  projectId,
  limit,
}: {
  projectId?: string
  limit?: number
}): Promise<ListSandboxTemplatesResult> {
  let pageLimit = limit
  if (!limit || limit > PAGE_LIMIT) {
    pageLimit = PAGE_LIMIT
  }

  const templates: e2b.components['schemas']['Template'][] = []
  let nextToken: string | undefined

  do {
    const res = await client.api.GET('/v2/templates', {
      params: {
        // the backend API still calls the project ID "teamID"
        query: { teamID: projectId, limit: pageLimit, nextToken },
      },
    })

    handleE2BRequestError(res, 'Error getting templates')
    templates.push(...res.data)
    nextToken = res.response.headers.get('x-next-token') || undefined
  } while (nextToken && (!limit || templates.length < limit))

  return {
    templates: limit ? templates.slice(0, limit) : templates,
    // We can't change the page size during iteration, so we may have to check if we have more templates than the limit
    hasMore: !!nextToken || (limit ? templates.length > limit : false),
  }
}
