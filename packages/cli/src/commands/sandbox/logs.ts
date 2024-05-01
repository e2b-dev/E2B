import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'
import * as chalk from 'chalk'

import { client, ensureAPIKey } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { listSandboxes } from './list'
import { wait } from 'src/utils/wait'

const getSandboxLogs = e2b.withAPIKey(
  client.api.path('/sandboxes/{sandboxID}/logs').method('get').create(),
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

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

function isLevelIncluded(level: LogLevel, allowedLevel?: LogLevel) {
  if (!allowedLevel) {
    return true
  }

  switch (allowedLevel) {
    case LogLevel.DEBUG:
      return true
    case LogLevel.INFO:
      return level === LogLevel.INFO || level === LogLevel.WARN || level === LogLevel.ERROR
    case LogLevel.WARN:
      return level === LogLevel.WARN || level === LogLevel.ERROR
    case LogLevel.ERROR:
      return level === LogLevel.ERROR
  }
}

function formatEnum(e: { [key: string]: string }) {
  return Object.values(e).map(level => asBold(level)).join(', ')
}

enum LogFormat {
  JSON = 'json',
  PRETTY = 'pretty',
}

enum LogService {
  PROCESS = 'process',
  FILESYSTEM = 'filesystem',
  TERMINAL = 'terminal',
  NETWORK = 'network',
  SYSTEM = 'system',
}


function cleanLogger(logger?: string) {
  if (!logger) {
    return ''
  }

  return logger.replaceAll('Svc', '')
}

export const logsCommand = new commander.Command('logs')
  .description('show logs for sandbox')
  .argument('<sandboxID>', `show logs for sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('lg')
  .option('-l, --level <level>', `filter logs by level (${formatEnum(LogLevel)}). The logs with the higher levels will be also shown.`, LogLevel.INFO)
  .option('-f, --follow', 'keep streaming logs until the sandbox is closed')
  .option('--format <format>', `specify format for printing logs (${formatEnum(LogFormat)})`, LogFormat.PRETTY)
  .option('-s, --services [services]', `filter logs by service. The available services are ${formatEnum(LogService)}. Specify multiple services by separating them with a comma.`, (value) => {
    const services = value.split(',').map(s => s.trim()) as LogService[]
    // Check if all services are valid
    services.forEach(s => {
      if (!Object.values(LogService).includes(s)) {
        console.error(`Invalid service used as argument: "${s}"\nValid services are ${formatEnum(LogService)}`)
        process.exit(1)
      }
    })

    return services
  }, [LogService.PROCESS, LogService.FILESYSTEM])
  .action(async (sandboxID: string, opts?: {
    level: string,
    follow: boolean,
    format: LogFormat,
    services: LogService[] | boolean,
  }) => {
    try {
      const level = opts?.level.toUpperCase() as LogLevel | undefined
      if (level && !Object.values(LogLevel).includes(level)) {
        throw new Error(`Invalid log level: ${level}`)
      }

      const format = opts?.format.toLowerCase() as LogFormat | undefined
      if (format && !Object.values(LogFormat).includes(format)) {
        throw new Error(`Invalid log format: ${format}`)
      }

      const apiKey = ensureAPIKey()

      const getIsRunning = opts?.follow ? waitForSandboxEnd(apiKey, sandboxID) : () => false

      let start: number | undefined
      let isFirstRun = true
      let firstLogsPrinted = false

      if (format === LogFormat.PRETTY) {
        console.log(`\nLogs for sandbox ${asBold(sandboxID)}:`)
      }

      const isRunningPromise = listSandboxes({ apiKey }).then(r => r.find(s => getLongID(s.sandboxID, s.clientID) === sandboxID)).then(s => !!s)

      do {
        try {
          const logs = await listSandboxLogs({ apiKey, sandboxID, start })

          if (logs.length !== 0 && firstLogsPrinted === false) {
            firstLogsPrinted = true
            process.stdout.write('\n')
          }

          for (const log of logs) {
            printLog(log.timestamp, log.line, level, format, opts?.services)
          }

          const isRunning = await isRunningPromise

          if (!isRunning && logs.length === 0 && isFirstRun) {
            if (format === LogFormat.PRETTY) {
              console.log(`\nStopped printing logs — sandbox ${withUnderline('not found')}`)
            }
            break
          }

          if (!isRunning) {
            if (format === LogFormat.PRETTY) {
              console.log(`\nStopped printing logs — sandbox is ${withUnderline('closed')}`)
            }
            break
          }

          const lastLog = logs.length > 0 ? logs[logs.length - 1] : undefined
          if (lastLog) {
            // TODO: Use the timestamp from the last log instead of the current time?
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
      } while (getIsRunning() && opts?.follow)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function printLog(timestamp: string, line: string, allowedLevel: LogLevel | undefined, format: LogFormat | undefined, allowedLoggers?: LogService[] | boolean) {
  const log = JSON.parse(line)
  let level = log['level'].toUpperCase()

  log.logger = cleanLogger(log.logger)

  // Check if the current logger startsWith any of the allowed loggers. If there are no specified loggers, print logs from all services.
  if (allowedLoggers !== true && Array.isArray(allowedLoggers) && !allowedLoggers.some(allowedLogger => log.logger.startsWith(allowedLogger))) {
    return
  }

  if (!isLevelIncluded(level, allowedLevel)) {
    return
  }

  switch (level) {
    case LogLevel.DEBUG:
      level = chalk.default.bgWhite(level)
      break
    case LogLevel.INFO:
      level = chalk.default.bgGreen(level) + ' '
      break
    case LogLevel.WARN:
      level = chalk.default.bgYellow(level) + ' '
      break
    case LogLevel.ERROR:
      level = chalk.default.white(chalk.default.bgRed(level))
      break
  }

  delete log['traceID']
  delete log['instanceID']
  delete log['source_type']
  delete log['teamID']
  delete log['source']
  delete log['service']
  delete log['envID']
  delete log['sandboxID']

  if (format === LogFormat.JSON) {
    console.log(JSON.stringify({
      timestamp: new Date(timestamp).toISOString(),
      level,
      ...log,
    }))
  } else {
    const time = `[${new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '')}]`
    delete log['level']
    console.log(`${asTimestamp(time)} ${level} ` + util.inspect(log, { colors: true, depth: null, maxArrayLength: Infinity, sorted: true, compact: true, breakLength: Infinity }))
  }
}

export async function listSandboxLogs({
  apiKey,
  sandboxID,
  start,
}: { apiKey: string, sandboxID: string, start?: number }): Promise<e2b.components['schemas']['SandboxLog'][]> {
  const response = await getSandboxLogs(apiKey, { sandboxID, start })
  return response.data.logs
}
