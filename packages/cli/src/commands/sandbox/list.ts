import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import { components, Sandbox, SandboxInfo } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { parseMetadata } from './utils'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

function getStateTitle(state?: components['schemas']['SandboxState'][]) {
  if (state?.length === 1) {
    if (state?.includes('running')) return 'Running sandboxes'
    if (state?.includes('paused')) return 'Paused sandboxes'
  }
  return 'Sandboxes'
}

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
      })

      if (format === 'pretty') {
        renderTable(sandboxes, state)
        if (hasMore) {
          console.log(
            `Showing first ${limit} sandboxes. Use --limit to change.`
          )
        }
      } else if (format === 'json') {
        console.log(JSON.stringify(sandboxes, null, 2))
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function renderTable(
  sandboxes: SandboxInfo[],
  state: components['schemas']['SandboxState'][]
) {
  if (!sandboxes?.length) {
    console.log('No sandboxes found')
    return
  }

  const table = new tablePrinter.Table({
    title: getStateTitle(state),
    columns: [
      { name: 'sandboxId', alignment: 'left', title: 'Sandbox ID' },
      {
        name: 'templateId',
        alignment: 'left',
        title: 'Template ID',
        maxLen: 20,
      },
      { name: 'name', alignment: 'left', title: 'Alias' },
      { name: 'startedAt', alignment: 'left', title: 'Started at' },
      { name: 'endAt', alignment: 'left', title: 'End at' },
      { name: 'state', alignment: 'left', title: 'State' },
      { name: 'cpuCount', alignment: 'left', title: 'vCPUs' },
      { name: 'memoryMB', alignment: 'left', title: 'RAM MiB' },
      { name: 'envdVersion', alignment: 'left', title: 'Envd version' },
      { name: 'metadata', alignment: 'left', title: 'Metadata' },
    ],
    disabledColumns: ['clientID'],
    rows: sandboxes
      .map((sandbox) => ({
        ...sandbox,
        startedAt: new Date(sandbox.startedAt).toLocaleString(),
        endAt: new Date(sandbox.endAt).toLocaleString(),
        state: sandbox.state.charAt(0).toUpperCase() + sandbox.state.slice(1), // capitalize
        metadata: JSON.stringify(sandbox.metadata),
      }))
      .sort(
        (a, b) =>
          a.startedAt.localeCompare(b.startedAt) ||
          a.sandboxId.localeCompare(b.sandboxId)
      ),
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

type ListSandboxesOptions = {
  limit?: number
  state?: components['schemas']['SandboxState'][]
  metadataRaw?: string
}

type ListSandboxesResult = {
  sandboxes: SandboxInfo[]
  hasMore: boolean
}

export async function listSandboxes({
  limit,
  state,
  metadataRaw,
}: ListSandboxesOptions = {}): Promise<ListSandboxesResult> {
  const apiKey = ensureAPIKey()
  const metadata = parseMetadata(metadataRaw)

  let pageLimit = limit
  if (!limit || limit > PAGE_LIMIT) {
    pageLimit = PAGE_LIMIT
  }

  let remainingLimit = limit
  const sandboxes: SandboxInfo[] = []
  const iterator = Sandbox.list({
    apiKey: apiKey,
    limit: pageLimit,
    query: { state, metadata },
  })

  while (iterator.hasNext && (!remainingLimit || remainingLimit > 0)) {
    const batch = await iterator.nextItems()
    sandboxes.push(...batch)

    if (limit && remainingLimit) {
      remainingLimit -= batch.length
    }
  }

  return {
    sandboxes: limit ? sandboxes.slice(0, limit) : sandboxes,
    // We can't change the page size during iteration, so we may have to check if we have more sandboxes than the limit
    hasMore: iterator.hasNext || (limit ? sandboxes.length > limit : false),
  }
}
