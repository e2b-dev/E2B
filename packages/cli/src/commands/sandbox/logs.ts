import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'

import { ensureAPIKey } from 'src/api'
import { asBold, asTimestamp, asPrimary, asDim } from 'src/utils/format'
import { listSandboxes } from './list'

const getSandboxLogs = e2b.withAPIKey(
  e2b.api.path('/sandboxes/{sandboxID}/logs').method('get').create(),
)

const maxRuntime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export const logsCommand = new commander.Command('logs')
  .description('show logs for sandbox')
  .argument('<sandboxID>', `show longs for sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('lg')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()
      const runningSandboxes = listSandboxes({ apiKey })

      console.log(util.inspect({
        apiKey,
        sandboxID,
      }, { colors: true, depth: null, maxArrayLength: Infinity, sorted: true, compact: true, breakLength: Infinity }))

      const startTime = new Date().getTime()

      let start: number | undefined
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const currentTime = new Date().getTime()
        const elapsedTime = currentTime - startTime // Time elapsed in milliseconds

        // Check if 24 hours (in milliseconds) have passed
        if (elapsedTime >= maxRuntime) {
          console.log('Stopped printing logs after 24 hours.')
          break
        }

        const [info, logs] = await Promise.all([
          start === undefined ? runningSandboxes : undefined,
          listSandboxLogs({ apiKey, sandboxID, start }),
        ])

        if (info) {
          const sandbox = info.find(s => s.sandboxID === sandboxID)

          printSandboxInfo({
            isRunning: !!sandbox,
            envID: logs.envID,
            sandboxID: logs.sandboxID,
          })
        }

        for (const log of logs.logs) {
          printLog(log.timestamp, log.line)
        }

        const lastLog = logs.logs[logs.logs.length - 1]
        if (lastLog) {
          start = new Date(lastLog.timestamp).getTime()
        }
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function printSandboxInfo({ envID, sandboxID, isRunning }: {
  envID: string,
  sandboxID: string,
  isRunning: boolean,
}) {
  process.stdout.write(`Logs for ${asBold(isRunning ? 'running' : 'closed')} sandbox ${asPrimary(sandboxID)} created from template ${asDim(envID)}:\n\n`)
}

function printLog(timestamp: string, line: string) {
  const log = JSON.parse(line)

  delete log['TraceID']
  delete log['envID']
  delete log['instanceID']
  delete log['sandboxID']
  delete log['source_type']
  delete log['teamID']
  delete log['source']
  delete log['service']

  const time = `[${timestamp}]`
  console.log(`${asTimestamp(time)} ` + util.inspect(log, { colors: true, depth: null, maxArrayLength: Infinity, sorted: true, compact: true, breakLength: Infinity }))
}

export async function listSandboxLogs({
  apiKey,
  sandboxID,
  start,
}: { apiKey: string, sandboxID: string, start?: number }): Promise<e2b.components['schemas']['SandboxLogs']> {
  const response = await getSandboxLogs(apiKey, { sandboxID, start })
  return response.data
}
