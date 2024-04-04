import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'

import { ensureAPIKey } from 'src/api'
import { asBold, asTimestamp, asPrimary } from 'src/utils/format'
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

      const startTime = new Date().getTime()

      let start: number | undefined
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const currentTime = new Date().getTime()
        const elapsedTime = currentTime - startTime // Time elapsed in milliseconds

        // Check if 24 hours (in milliseconds) have passed
        if (elapsedTime >= maxRuntime) {
          console.log('\nStopped printing logs — 24 hours have passed')
          break
        }

        const [info, logs] = await Promise.all([
          start === undefined ? runningSandboxes : undefined,
          listSandboxLogs({ apiKey, sandboxID, start }),
        ])

        const sandbox = info ? info.find(s => s.sandboxID === sandboxID) : undefined
        const isRunning = !!sandbox

        printSandboxInfo({
          isRunning: isRunning,
          sandboxID: sandboxID,
        })

        for (const log of logs) {
          printLog(log.timestamp, log.line)
        }

        if (!isRunning) {
          console.log('\nStopped printing logs — sandbox is closed')
          break
        }

        const lastLog = logs[logs.length - 1]
        if (lastLog) {
          start = new Date(lastLog.timestamp).getTime()
        }
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function printSandboxInfo({ sandboxID, isRunning }: {
  sandboxID: string,
  isRunning: boolean,
}) {
  process.stdout.write(`\nLogs for ${asBold(isRunning ? 'running' : 'closed')} sandbox ${asPrimary(sandboxID)}:\n\n`)
}

function printLog(timestamp: string, line: string) {
  const log = JSON.parse(line)

  const time = `[${new Date(timestamp).toISOString()}]`
  const level = log['level'].toUpperCase()

  delete log['traceID']
  delete log['instanceID']
  delete log['sandboxID']
  delete log['source_type']
  delete log['teamID']
  delete log['source']
  delete log['service']
  delete log['envID']
  delete log['level']

  console.log(`${asTimestamp(time)} ${level} ` + util.inspect(log, { colors: true, depth: null, maxArrayLength: Infinity, sorted: true, compact: true, breakLength: Infinity }))
}

export async function listSandboxLogs({
  apiKey,
  sandboxID,
  start,
}: { apiKey: string, sandboxID: string, start?: number }): Promise<e2b.components['schemas']['SandboxLog'][]> {
  const response = await getSandboxLogs(apiKey, { sandboxID, start })
  return response.data.logs
}
