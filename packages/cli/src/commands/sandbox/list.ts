import * as commander from 'commander'
import { components, Sandbox, SandboxInfo, SandboxListOrder } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { renderTable } from 'src/utils/table'
import { parseMetadata } from './utils'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

export const listCommand = new commander.Command('list')
  .description('list all sandboxes, by default it list only running ones')
  .alias('ls')
  .option(
    '-s, --state <state>',
    'filter by state, eg. running, paused. Defaults to running',
    (value) => value.split(',')
  )
  .option('-m, --metadata <metadata>', 'filter by metadata, eg. key1=value1')
  .option(
    '-t, --template <template>',
    'filter by template ID or alias, eg. base'
  )
  .option(
    '--started-after <date>',
    'filter by start time, only sandboxes started at or after this time are returned, eg. 2025-01-01T00:00:00Z',
    (value) => {
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        throw new commander.InvalidArgumentError(
          'Invalid date, expected an ISO 8601 timestamp, eg. 2025-01-01T00:00:00Z'
        )
      }
      return date
    }
  )
  .option(
    '-o, --order <order>',
    'sort order by start time, asc or desc (default: desc)',
    (value) => {
      if (value !== 'asc' && value !== 'desc') {
        throw new commander.InvalidArgumentError(
          "Invalid order, expected 'asc' or 'desc'"
        )
      }
      return value
    }
  )
  .option(
    '-l, --limit <limit>',
    `limit the number of sandboxes returned (default: ${DEFAULT_LIMIT}, 0 for no limit)`,
    (value) => parseInt(value)
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (options) => {
    try {
      const state = options.state || ['running']
      const format = options.format || 'pretty'
      const limit =
        options.limit === 0 ? undefined : (options.limit ?? DEFAULT_LIMIT)
      const { sandboxes, hasMore } = await listSandboxes({
        limit,
        state,
        metadataRaw: options.metadata,
        template: options.template,
        startedAfter: options.startedAfter,
        order: options.order,
      })

      if (format === 'pretty') {
        renderSandboxTable(sandboxes, options.order)
        if (hasMore) {
          console.log(
            `Showing first ${limit} sandboxes. Use --limit to change.`
          )
        }
      } else if (format === 'json') {
        console.log(
          JSON.stringify(sortSandboxes(sandboxes, options.order), null, 2)
        )
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export function sortSandboxes(
  sandboxes: SandboxInfo[],
  order: SandboxListOrder = 'asc'
) {
  const sign = order === 'desc' ? -1 : 1
  return sandboxes
    .slice()
    .sort(
      (a, b) =>
        sign *
          (new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) ||
        a.sandboxId.localeCompare(b.sandboxId)
    )
}

export function buildTableRows(
  sandboxes: SandboxInfo[],
  order: SandboxListOrder = 'asc'
) {
  return sortSandboxes(sandboxes, order).map((sandbox) => ({
    ...sandbox,
    startedAt: new Date(sandbox.startedAt).toLocaleString(),
    endAt: new Date(sandbox.endAt).toLocaleString(),
    state: sandbox.state.charAt(0).toUpperCase() + sandbox.state.slice(1), // capitalize
    metadata: JSON.stringify(sandbox.metadata),
  }))
}

function renderSandboxTable(
  sandboxes: SandboxInfo[],
  order?: SandboxListOrder
) {
  if (!sandboxes?.length) {
    console.log('No sandboxes found')
    return
  }

  renderTable(buildTableRows(sandboxes, order), [
    { header: 'Sandbox ID', value: (row) => row.sandboxId },
    { header: 'Template ID', value: (row) => row.templateId },
    { header: 'Alias', value: (row) => row.name ?? '' },
    { header: 'Started at', value: (row) => row.startedAt },
    { header: 'End at', value: (row) => row.endAt },
    { header: 'State', value: (row) => row.state },
    { header: 'vCPUs', value: (row) => String(row.cpuCount) },
    { header: 'RAM MiB', value: (row) => String(row.memoryMB) },
    { header: 'Envd version', value: (row) => row.envdVersion },
    { header: 'Metadata', value: (row) => row.metadata },
  ])
}

type ListSandboxesOptions = {
  limit?: number
  state?: components['schemas']['SandboxState'][]
  metadataRaw?: string
  template?: string
  startedAfter?: Date
  order?: SandboxListOrder
}

type ListSandboxesResult = {
  sandboxes: SandboxInfo[]
  hasMore: boolean
}

export async function listSandboxes({
  limit,
  state,
  metadataRaw,
  template,
  startedAfter,
  order,
}: ListSandboxesOptions = {}): Promise<ListSandboxesResult> {
  const apiKey = ensureAPIKey()
  const metadata = parseMetadata(metadataRaw)

  let pageLimit = limit
  if (!limit || limit > PAGE_LIMIT) {
    pageLimit = PAGE_LIMIT
  }

  const sandboxes: SandboxInfo[] = []
  const iterator = Sandbox.list({
    apiKey: apiKey,
    limit: pageLimit,
    query: { state, metadata, template, startedAfter },
    order,
  })

  while (iterator.hasNext && (!limit || sandboxes.length < limit)) {
    const batch = await iterator.nextItems()
    sandboxes.push(...batch)
  }

  return {
    sandboxes: limit ? sandboxes.slice(0, limit) : sandboxes,
    // We can't change the page size during iteration, so we may have to check if we have more sandboxes than the limit
    hasMore: iterator.hasNext || (limit ? sandboxes.length > limit : false),
  }
}
