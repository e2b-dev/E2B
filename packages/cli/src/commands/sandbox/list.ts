import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { ensureAPIKey, client, connectionConfig } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'

export const listCommand = new commander.Command('list')
  .description('list all running sandboxes')
  .alias('ls')
  .option('-s, --state <state>', 'filter by state', (value) => value.split(','))
  .option('-f, --filters <filters>', 'filter by metadata', (value) =>
    value.replace(/,/g, '&')
  )
  .action(async (options) => {
    try {
      const sandboxes = await listSandboxes({
        state: options.state,
        filters: options.filters,
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
              sandboxID: `${sandbox.sandboxID}-${sandbox.clientID}`,
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
  state?: e2b.components['schemas']['SandboxState'][]
  filters?: string
}

export async function listSandboxes({
  state,
  filters,
}: ListSandboxesOptions = {}): Promise<
  e2b.components['schemas']['ListedSandbox'][]
> {
  ensureAPIKey()

  const signal = connectionConfig.getSignal()
  const res = await client.api.GET('/sandboxes', {
    params: {
      query: { state, query: filters },
    },
    signal,
  })

  handleE2BRequestError(res.error, 'Error getting running sandboxes')

  return res.data
}
