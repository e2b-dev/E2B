import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'
import * as chalk from 'chalk'

import { ensureAPIKey } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { listSandboxes } from './list'
import { wait } from 'src/utils/wait'

const getSandboxLogs = e2b.withAPIKey(
  e2b.api.path('/sandboxes/{sandboxID}/logs').method('get').create(),
)

const maxRuntime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

function getLongID(sandboxID: string, clientID?: string) {
  if (clientID) {
    return `${sandboxID}-${clientID}`
  }
  return sandboxID
}

function waitForSandboxEnd(apiKey: string, sandboxID: string) {
  let isRunning = true

  async function monitor() {
    const startTime = new Date().getTime()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentTime = new Date().getTime()
      const elapsedTime = currentTime - startTime // Time elapsed in milliseconds

      // Check if 24 hours (in milliseconds) have passed
      if (elapsedTime >= maxRuntime) {
        break
      }

      const response = await listSandboxes({ apiKey })
      const sandbox = response.find(s => getLongID(s.sandboxID, s.clientID) === sandboxID)
      if (!sandbox) {
        isRunning = false
        break
      }
      await wait(5000)
    }
  }

  monitor()

  return () => isRunning
}

export const logsCommand = new commander.Command('logs')
  .description('show logs for sandbox')
  .argument('<sandboxID>', `show longs for sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('lg')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()
      const getIsRunning = waitForSandboxEnd(apiKey, sandboxID)

      let start: number | undefined
      let isFirstRun = true
      let firstLogsPrinted = false

      console.log(`\nLogs for sandbox ${asBold(sandboxID)}:`)

      const isRunningPromise = listSandboxes({ apiKey }).then(r => r.find(s => getLongID(s.sandboxID, s.clientID) === sandboxID)).then(s => !!s)

      do {
        try {
          const logs = await listSandboxLogs({ apiKey, sandboxID, start })

          if (logs.length !== 0 && firstLogsPrinted === false) {
            firstLogsPrinted = true
            process.stdout.write('\n')
          }

          for (const log of logs) {
            printLog(log.timestamp, log.line)
          }

          const isRunning = await isRunningPromise

          if (!isRunning && logs.length === 0 && isFirstRun) {
            console.log(`\nStopped printing logs — sandbox ${withUnderline('not found')}`)
            break
          }

          if (!isRunning) {
            console.log(`\nStopped printing logs — sandbox is ${withUnderline('closed')}`)
            break
          }

          const lastLog = logs.length > 0 ? logs[logs.length - 1] : undefined
          if (lastLog) {
            start = new Date(lastLog.timestamp).getTime() + 1
          }
        } catch (e) {
          if (e instanceof getSandboxLogs.Error) {
            const error = e.getActualType()
            if (error.status === 401) {
              throw new Error(
                `Error getting sandbox logs - (${error.status}) bad request: ${error}`,
              )
            }
            if (error.status === 404) {
              throw new Error(
                `Error getting sandbox logs - (${error.status}) not found: ${error}`,
              )
            }
            if (error.status === 500) {
              throw new Error(
                `Error getting sandbox logs - (${error.status}) server error: ${error}`,
              )
            }
          }
          throw e
        }

        await wait(400)
        isFirstRun = false
      } while (getIsRunning())
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function printLog(timestamp: string, line: string) {
  const log = JSON.parse(line)

  const time = `[${new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '')}]`
  let level = log['level'].toUpperCase()

  switch (level) {
    case 'DEBUG':
      level = chalk.default.bgWhite(level)
      break
    case 'INFO':
      level = chalk.default.bgGreen(level) + ' '
      break
    case 'WARN':
      level = chalk.default.bgYellow(level) + ' '
      break
    case 'ERROR':
      level = chalk.default.white(chalk.default.bgRed(level))
      break
  }

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
