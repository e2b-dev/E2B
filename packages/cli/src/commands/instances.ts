import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from '@e2b/sdk'

import { ensureAPIKey } from 'src/api'

const listRunningSandboxes = e2b.withAPIKey(
  e2b.api.path('/instances').method('get').create(),
)

export const instancesCommand = new commander.Command('instances')
  .description('List all sandboxes')
  .alias('ins')
  .action(async () => {
    try {
      const apiKey = ensureAPIKey()
      const sandboxes = await listSandboxes({ apiKey })

      if (!sandboxes?.length) {
        console.log('No running sandboxes.')
      } else {
        const table = new tablePrinter.Table({
          title: 'Running sandboxes',
          columns: [
            { name: 'instanceID', alignment: 'left', title: 'Sandbox ID' },
            { name: 'envID', alignment: 'left', title: 'Template ID' },
            { name: 'startedAt', alignment: 'left', title: 'Started at' },
          ],
          disabledColumns: ['clientID'],
          rows: sandboxes.map((sandbox) => ({ ...sandbox, startedAt: new Date(sandbox.startedAt).toLocaleString() })),
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

export async function listSandboxes({
  apiKey,
}: { apiKey: string }): Promise<e2b.components['schemas']['RunningInstance'][]> {
  const response = await listRunningSandboxes(apiKey, {})
  return response.data
}
