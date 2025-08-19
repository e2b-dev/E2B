import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import { components } from 'e2b'

import { client, connectionConfig, ensureAPIKey } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'

export const listCommand = new commander.Command('list')
  .description('list all running sandboxes')
  .alias('ls')
  .option(
    '-s, --state <state>',
    'filter by state, eg. running, stopped',
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
      const sandboxes = await listSandboxes({
        limit: options.limit,
        state: options.state,
        metadata: options.metadata,
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
              sandboxID: sandbox.sandboxID,
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
  metadata?: string
}

export async function listSandboxes({
  limit,
  state,
  metadata,
}: ListSandboxesOptions = {}): Promise<
  components['schemas']['ListedSandbox'][]
> {
  ensureAPIKey()

  const signal = connectionConfig.getSignal()

  let hasNext = true
  let nextToken: string | undefined
  let remainingLimit: number | undefined = limit

  const sandboxes: components['schemas']['ListedSandbox'][] = []

  while (hasNext && (!limit || (remainingLimit && remainingLimit > 0))) {
    const res = await client.api.GET('/v2/sandboxes', {
      params: {
        query: {
          state,
          metadata,
          nextToken,
          limit: remainingLimit,
        },
      },
      signal,
    })

    handleE2BRequestError(res, 'Error getting running sandboxes')

    nextToken = res.response.headers.get('x-next-token') || undefined
    hasNext = !!nextToken
    sandboxes.push(...res.data)
    if (limit && remainingLimit) {
      remainingLimit -= res.data.length
    }
  }

  return sandboxes
}
