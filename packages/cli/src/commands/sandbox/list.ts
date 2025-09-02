import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import { components, Sandbox, SandboxInfo } from 'e2b'

import { ensureAPIKey } from 'src/api'

export const listCommand = new commander.Command('list')
  .description('list all sandboxes, by default it list only running ones')
  .alias('ls')
  .option(
    '-s, --state <state>',
    'filter by state, eg. running, paused. Defaults to running',
    (value) => value.split(',')
  )
  .option(
    '-m, --metadata <metadata>',
    'filter by metadata, eg. key1=value1',
    (value) => value.replace(/,/g, '&')
  )
  .option(
    '-l, --limit <limit>',
    'limit the number of sandboxes returned',
    (value) => parseInt(value)
  )
  .action(async (options) => {
    try {
      const state = options.state || ['running']
      const sandboxes = await listSandboxes({
        limit: options.limit,
        state,
        metadataRaw: options.metadata,
      })

      if (!sandboxes?.length) {
        console.log('No sandboxes found')
      } else {
        const table = new tablePrinter.Table({
          title: 'Running sandboxes',
          columns: [
            { name: 'sandboxID', alignment: 'left', title: 'Sandbox ID' },
            {
              name: 'templateID',
              alignment: 'left',
              title: 'Template ID',
              maxLen: 20,
            },
            { name: 'alias', alignment: 'left', title: 'Alias' },
            { name: 'startedAt', alignment: 'left', title: 'Started at' },
            { name: 'endAt', alignment: 'left', title: 'End at' },
            { name: 'state', alignment: 'left', title: 'State' },
            { name: 'cpuCount', alignment: 'left', title: 'vCPUs' },
            { name: 'memoryMB', alignment: 'left', title: 'RAM MiB' },
            { name: 'metadata', alignment: 'left', title: 'Metadata' },
          ],
          disabledColumns: ['clientID'],
          rows: sandboxes
            .map((sandbox) => ({
              ...sandbox,
              sandboxID: sandbox.sandboxId,
              startedAt: new Date(sandbox.startedAt).toLocaleString(),
              endAt: new Date(sandbox.endAt).toLocaleString(),
              state:
                sandbox.state.charAt(0).toUpperCase() + sandbox.state.slice(1), // capitalize
              metadata: JSON.stringify(sandbox.metadata),
            }))
            .sort(
              (a, b) =>
                a.startedAt.localeCompare(b.startedAt) ||
                a.sandboxID.localeCompare(b.sandboxID)
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
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

type ListSandboxesOptions = {
  limit?: number
  state?: components['schemas']['SandboxState'][]
  metadataRaw?: string
}

export async function listSandboxes({
  limit,
  state,
  metadataRaw,
}: ListSandboxesOptions = {}): Promise<SandboxInfo[]> {
  const apiKey = ensureAPIKey()

  let metadata: Record<string, string> | undefined = undefined
  if (metadataRaw && metadataRaw.length > 0) {
    const parsedMetadata: Record<string, string> = {}
    metadataRaw.split(',').map((pair: string) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        parsedMetadata[key.trim()] = value.trim()
      }
    })

    metadata = parsedMetadata
  }

  let pageLimit = limit
  if (!limit || limit > 100) {
    pageLimit = 100
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

  return sandboxes
}
