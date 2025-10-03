import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'
import * as chalk from 'chalk'

import { client, connectionConfig } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { wait } from 'src/utils/wait'
import { handleE2BRequestError } from '../../utils/errors'
import { waitForSandboxEnd, formatEnum, Format, isRunning } from './utils'

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
      return (
        level === LogLevel.INFO ||
        level === LogLevel.WARN ||
        level === LogLevel.ERROR
      )
    case LogLevel.WARN:
      return level === LogLevel.WARN || level === LogLevel.ERROR
    case LogLevel.ERROR:
      return level === LogLevel.ERROR
  }
}

function cleanLogger(logger?: string) {
  if (!logger) {
    return ''
  }

  return logger.replaceAll('Svc', '')
}

export const logsCommand = new commander.Command('logs')
  .description('show logs for sandbox')
  .argument(
    '<sandboxID>',
    `show logs for sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('lg')
  .option(
    '--level <level>',
    `filter logs by level (${formatEnum(
      LogLevel
    )}). The logs with the higher levels will be also shown.`,
    LogLevel.INFO
  )
  .option('-f, --follow', 'keep streaming logs until the sandbox is closed')
  .option(
    '--format <format>',
    `specify format for printing logs (${formatEnum(Format)})`,
    Format.PRETTY
  )
  .option(
    '--loggers [loggers]',
    'filter logs by loggers. Specify multiple loggers by separating them with a comma.',
    (val: string) => val.split(',')
  )
  .action(
    async (
      sandboxID: string,
      opts?: {
        level: string
        follow: boolean
        format: Format
        loggers?: string[]
      }
    ) => {
      try {
        const level = opts?.level.toUpperCase() as LogLevel | undefined
        if (level && !Object.values(LogLevel).includes(level)) {
          throw new Error(`Invalid log level: ${level}`)
        }

        const format = opts?.format.toLowerCase() as Format | undefined
        if (format && !Object.values(Format).includes(format)) {
          throw new Error(`Invalid log format: ${format}`)
        }

        const getIsRunning = opts?.follow
          ? waitForSandboxEnd(sandboxID)
          : () => false

        let start: number | undefined
        let isFirstRun = true
        let firstLogsPrinted = false

        if (format === Format.PRETTY) {
          console.log(`\nLogs for sandbox ${asBold(sandboxID)}:`)
        }

        do {
          const logs = await listSandboxLogs({ sandboxID, start })

          if (logs.length !== 0 && firstLogsPrinted === false) {
            firstLogsPrinted = true
            process.stdout.write('\n')
          }

          for (const log of logs) {
            printLog(
              log.timestamp,
              log.line,
              level,
              format,
              opts?.loggers ?? undefined
            )
          }

          const isSandboxRunning = await isRunning(sandboxID)

          if (!isSandboxRunning && logs.length === 0 && isFirstRun) {
            if (format === Format.PRETTY) {
              console.log(
                `\nStopped printing logs — sandbox ${withUnderline(
                  'not found'
                )}`
              )
            }
            break
          }

          if (!isSandboxRunning) {
            if (format === Format.PRETTY) {
              console.log(
                `\nStopped printing logs — sandbox is ${withUnderline(
                  'closed'
                )}`
              )
            }
            break
          }

          const lastLog = logs.length > 0 ? logs[logs.length - 1] : undefined
          if (lastLog) {
            // TODO: Use the timestamp from the last log instead of the current time?
            start = new Date(lastLog.timestamp).getTime() + 1
          }

          await wait(400)
          isFirstRun = false
        } while (getIsRunning() && opts?.follow)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

function printLog(
  timestamp: string,
  line: string,
  allowedLevel: LogLevel | undefined,
  format: Format | undefined,
  allowedLoggers?: string[] | undefined
) {
  const log = JSON.parse(line)
  let level = log['level'].toUpperCase()

  log.logger = cleanLogger(log.logger)

  // Check if the current logger startsWith any of the allowed loggers. If there are no specified loggers, print logs from all loggers.
  if (
    allowedLoggers !== undefined &&
    Array.isArray(allowedLoggers) &&
    !allowedLoggers.some((allowedLogger) =>
      log.logger.startsWith(allowedLogger)
    )
  ) {
    return
  }

  if (!isLevelIncluded(level, allowedLevel)) {
    return
  }

  switch (level) {
    case LogLevel.DEBUG:
      level = chalk.default.black(chalk.default.bgWhite(level))
      break
    case LogLevel.INFO:
      level = chalk.default.black(chalk.default.bgGreen(level) + ' ')
      break
    case LogLevel.WARN:
      level = chalk.default.black(chalk.default.bgYellow(level) + ' ')
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

  if (format === Format.JSON) {
    console.log(
      JSON.stringify({
        timestamp: new Date(timestamp).toISOString(),
        level,
        ...log,
      })
    )
  } else {
    const time = `[${new Date(timestamp).toISOString().replace(/T/, ' ')}]`
    delete log['level']
    console.log(
      `${asTimestamp(time)} ${level} ` +
        util.inspect(log, {
          colors: true,
          depth: null,
          maxArrayLength: Infinity,
          sorted: true,
          compact: true,
          breakLength: Infinity,
        })
    )
  }
}

export async function listSandboxLogs({
  sandboxID,
  start,
}: {
  sandboxID: string
  start?: number
}): Promise<e2b.components['schemas']['SandboxLog'][]> {
  const signal = connectionConfig.getSignal()
  const res = await client.api.GET('/sandboxes/{sandboxID}/logs', {
    signal,
    params: {
      path: {
        sandboxID,
      },
      query: {
        start,
      },
    },
  })

  handleE2BRequestError(res, 'Error while getting sandbox logs')

  return res.data.logs
}
