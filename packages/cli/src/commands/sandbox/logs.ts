import * as commander from 'commander'
import * as e2b from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'

const getSandboxLogs = e2b.withAPIKey(
  e2b.api.path('/sandboxes/{sandboxID}/logs').method('get').create(),
)

export const logsCommand = new commander.Command('logs')
  .description('show logs for running sandbox')
  .argument('<sandboxID>', `show longs for sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('lg')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()

      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const logs = await listSandboxLogs({ apiKey, sandboxID, offset })
        offset = logs.logsOffset

        for (const log of logs.logs) {
          process.stdout.write(`${log}\n`)
        }
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export async function listSandboxLogs({
  apiKey,
  sandboxID,
  offset,
}: { apiKey: string, sandboxID: string, offset: number }): Promise<e2b.components['schemas']['SandboxLogs']> {
  const response = await getSandboxLogs(apiKey, { sandboxID, offset })
  return response.data
}
