import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import {ensureAPIKey, client, connectionConfig} from 'src/api'
import {handleE2BRequestError} from '../../utils/errors'

export const listCommand = new commander.Command('list')
  .description('list all running sandboxes')
  .alias('ls')
  .action(async () => {
    try {
      const sandboxes = await listSandboxes()

      if (!sandboxes?.length) {
        console.log('No running sandboxes.')
      } else {
        const table = new tablePrinter.Table({
          title: 'Running sandboxes',
          columns: [
            { name: 'sandboxID', alignment: 'left', title: 'Sandbox ID' },
            { name: 'templateID', alignment: 'left', title: 'Template ID' },
            { name: 'alias', alignment: 'left', title: 'Alias' },
            { name: 'startedAt', alignment: 'left', title: 'Started at' },
            { name: 'endAt', alignment: 'left', title: 'End at' },
            { name: 'cpuCount', alignment: 'left', title: 'vCPUs' },
            { name: 'memoryMB', alignment: 'left', title: 'RAM MiB' },
            { name: 'metadata', alignment: 'left', title: 'Metadata' },
          ],
          disabledColumns: ['clientID'],
          rows: sandboxes.map((sandbox) => ({ ...sandbox, sandboxID: `${sandbox.sandboxID}-${sandbox.clientID}`, startedAt: new Date(sandbox.startedAt).toLocaleString(), endAt: new Date(sandbox.endAt).toLocaleString(), metadata: JSON.stringify(sandbox.metadata) })).sort(
            (a, b) => a.startedAt.localeCompare(b.startedAt) || a.sandboxID.localeCompare(b.sandboxID)
          ),
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

export async function listSandboxes(): Promise<e2b.components['schemas']['RunningSandbox'][]> {
  ensureAPIKey()

  const signal = connectionConfig.getSignal()
  const res = await client.api.GET('/sandboxes', {signal})

  handleE2BRequestError(res.error, 'Error getting running sandboxes')

  return res.data
}
