import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'
import * as chalk from 'chalk'

import { ensureAPIKey } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { listSandboxes } from './list'
import { wait } from 'src/utils/wait'
import { createDeferredPromise } from 'src/utils/promise'

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

async function waitForSandboxEnd(apiKey: string, sandboxID: string) {
  const deferredPromise = createDeferredPromise()

  async function monitor() {
    const startTime = new Date().getTime()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await wait(10000)

      const currentTime = new Date().getTime()
      const elapsedTime = currentTime - startTime // Time elapsed in milliseconds

      // Check if 24 hours (in milliseconds) have passed
      if (elapsedTime >= maxRuntime) {
        break
      }

      const response = await listSandboxes({ apiKey })
      const sandbox = response.find(s => getLongID(s.sandboxID, s.clientID) === sandboxID)
      if (!sandbox) {
        deferredPromise.resolve()
        break
      }
    }
  }

  monitor()

  return deferredPromise.promise
}

export const logsCommand = new commander.Command('logs')
  .description('show logs for sandbox')
  .argument('<sandboxID>', `show longs for sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('lg')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()
      const runningSandboxes = listSandboxes({ apiKey })

      const startTime = new Date().getTime()

      let isFirstRun = true
      let isRunning = true

      waitForSandboxEnd(apiKey, sandboxID).then(() => {
        isRunning = false
      })

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

        const logsPromise = listSandboxLogs({ apiKey, sandboxID, start })
        const info = await runningSandboxes

        const sandbox = info ? info.find(s => getLongID(s.sandboxID, s.clientID) === sandboxID) : undefined
        isRunning = !!sandbox

        if (isFirstRun) {
          printSandboxInfo({
            isRunning: isRunning,
            sandboxID: sandboxID,
          })
        }

        try {
          const logs = await logsPromise

          for (const log of logs) {
            printLog(log.timestamp, log.line)
          }

          console.log('new logs', logs.length)

          if (!isRunning && logs.length === 0 && isFirstRun) {
            console.log(`\nStopped printing logs — sandbox ${withUnderline('not found')}`)
            break
          }

          if (!isRunning) {
            console.log(`\nStopped printing logs — sandbox is ${withUnderline('closed')}`)
            break
          }

          const lastLog = logs[logs.length - 1]
          start = (lastLog
            ? new Date(lastLog.timestamp).getTime() + 1
            : Date.now())
        } catch (e) {
          if (e instanceof getSandboxLogs.Error) {
            console.log('is instance of Error', e.getActualType())
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

        await wait(500)
        isFirstRun = false
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
  process.stdout.write(`\nLogs for ${withUnderline(isRunning ? 'running' : 'closed')} sandbox ${asBold(sandboxID)}:\n\n`)
}

function printLog(timestamp: string, line: string) {
  const log = JSON.parse(line)

  const time = `[${new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '')}]`
  let level = log['level'].toUpperCase()

  switch (level) {
    case 'DEBUG':
      level = chalk.default.bgWhite(level)
      break
    case 'INFO':
      level = chalk.default.bgGreen(level)
      break
    case 'WARN':
      level = chalk.default.bgYellow(level)
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
