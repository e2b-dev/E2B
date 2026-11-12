import * as commander from '@commander-js/extra-typings'
import { Template, TemplateInfo } from 'e2b'

import { listAliases } from '../../utils/format'
import { renderTable } from 'src/utils/table'
import { ensureAuth } from 'src/api'
import {
  deprecatedTeamOption,
  Format,
  parseFormat,
  projectIdFromOptions,
  projectOption,
} from '../../options'
import { integer, zodParser } from '../../validation'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

export const listCommand = new commander.Command('list')
  .description('list sandbox templates')
  .alias('ls')
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .option(
    '-l, --limit <limit>',
    `limit the number of templates returned (default: ${DEFAULT_LIMIT} for pretty output, no limit for json; 0 for no limit)`,
    zodParser(integer('Template limit', { min: 0 }))
  )
  .option(
    '-f, --format <format>',
    'output format, eg. json, pretty',
    parseFormat,
    Format.PRETTY
  )
  .action(async (opts) => {
    try {
      const defaultLimit =
        opts.format === Format.JSON ? undefined : DEFAULT_LIMIT
      const limit = opts.limit === 0 ? undefined : (opts.limit ?? defaultLimit)
      process.stdout.write('\n')

      const { templates, hasMore } = await listSandboxTemplates({
        projectId: projectIdFromOptions(opts),
        limit,
      })

      for (const template of templates) {
        template.names.sort()
      }

      if (opts.format === Format.PRETTY) {
        renderTemplateTable(templates)
        if (hasMore) {
          console.log(
            `Showing first ${limit} templates. Use --limit to change.`
          )
        }
      } else {
        console.log(JSON.stringify(templates, null, 2))
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export function renderTemplateTable(templates: TemplateInfo[]) {
  if (!templates?.length) {
    console.log('No templates found.')
    return
  }

  renderTable(templates, [
    {
      header: 'Access',
      value: (template) => (template.public ? 'Public' : 'Private'),
    },
    { header: 'Template ID', value: (template) => template.templateId },
    {
      header: 'Template Name',
      value: (template) => listAliases(template.names),
    },
    { header: 'vCPUs', value: (template) => String(template.cpuCount) },
    {
      header: 'Max vCPUs',
      value: (template) => template.maxCpuCount?.toString(),
    },
    { header: 'RAM MiB', value: (template) => String(template.memoryMB) },
    {
      header: 'Created at',
      value: (template) => template.createdAt.toLocaleDateString(),
    },
    {
      header: 'Disk size MiB',
      value: (template) => String(template.diskSizeMB),
    },
    { header: 'Envd version', value: (template) => template.envdVersion },
  ])
}

type ListSandboxTemplatesResult = {
  templates: TemplateInfo[]
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

  const auth = await ensureAuth(projectId)
  const templates: TemplateInfo[] = []
  const iterator = Template.list({ ...auth, limit: pageLimit })

  while (iterator.hasNext && (!limit || templates.length < limit)) {
    templates.push(...(await iterator.nextItems()))
  }

  return {
    templates: limit ? templates.slice(0, limit) : templates,
    // We can't change the page size during iteration, so we may have to check if we have more templates than the limit
    hasMore: iterator.hasNext || (limit ? templates.length > limit : false),
  }
}
