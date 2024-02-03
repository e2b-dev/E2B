import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { ensureAPIKey } from 'src/api'

const listRunningSandboxes = e2b.withAPIKey(
  e2b.api.path('/sandboxes').method('get').create(),
)

export const runningSandboxesCommand = new commander.Command('sandboxes')
  .description('List all running sandboxes')
  .alias('sb')
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
            { name: 'sandboxID', alignment: 'left', title: 'Sandbox ID' },
            { name: 'templateID', alignment: 'left', title: 'Template ID' },
            { name: 'alias', alignment: 'left', title: 'Alias' },
            { name: 'startedAt', alignment: 'left', title: 'Started at' },
            { name: 'metadata', alignment: 'left', title: 'Metadata'},
          ],
          disabledColumns: ['clientID'],
          rows: sandboxes.map((sandbox) => ({ ...sandbox, sandboxID: `${sandbox.sandboxID}-${sandbox.clientID}`,startedAt: new Date(sandbox.startedAt).toLocaleString(), metadata: JSON.stringify(sandbox.metadata) })),
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
}: { apiKey: string }): Promise<e2b.components['schemas']['RunningSandboxes'][]> {
  const response = await listRunningSandboxes(apiKey, {})
  return response.data
}
