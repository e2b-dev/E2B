import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'
import * as chalk from 'chalk'

import { client, connectionConfig } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { wait } from 'src/utils/wait'
import { handleE2BRequestError } from '../../utils/errors'
import { waitForSandboxEnd, formatEnum, Format, isRunning } from './utils'

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface PrintableSandboxLog {
  timestamp: string
  level: LogLevel
  log: Record<string, unknown>
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

const dataLevelAliases: Record<string, LogLevel> = {
  trace: LogLevel.DEBUG,
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warning: LogLevel.WARN,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.ERROR,
  panic: LogLevel.ERROR,
}

const promotedDataKeys = new Set([
  'level',
  'severity',
  'logger',
  'name',
  'message',
  'msg',
])

function getStringField(value: unknown) {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
}

function normalizeLevel(value?: string) {
  if (!value) {
    return undefined
  }

  return dataLevelAliases[value.toLowerCase()]
}

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    return parsed as Record<string, unknown>
  } catch {
    return undefined
  }
}

function parseJsonLineObjects(
  value: string
): Record<string, unknown>[] | undefined {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length <= 1) {
    return undefined
  }

  const entries: Record<string, unknown>[] = []
  for (const line of lines) {
    const parsed = parseJsonObject(line)
    if (!parsed) {
      return undefined
    }

    entries.push(parsed)
  }

  return entries
}

function parseDataEntries(
  value: unknown
): Record<string, unknown>[] | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return [value as Record<string, unknown>]
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const trimmed = value.trim()
  const parsedObject = parseJsonObject(trimmed)
  if (parsedObject) {
    return [parsedObject]
  }

  return parseJsonLineObjects(trimmed)
}

function getDisplayData(
  data: Record<string, unknown>
): Record<string, unknown> | undefined {
  const visibleEntries = Object.entries(data).filter(
    ([key]) => !promotedDataKeys.has(key)
  )

  if (visibleEntries.length === 0) {
    return undefined
  }

  return Object.fromEntries(visibleEntries)
}

function getCapturedBy(
  sourceLog: Record<string, unknown>
): Record<string, string> | undefined {
  const capturedBy = Object.fromEntries(
    [
      ['logger', getStringField(sourceLog.logger)],
      ['message', getStringField(sourceLog.message)],
      ['event_type', getStringField(sourceLog.event_type)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))
  )

  return Object.keys(capturedBy).length > 0 ? capturedBy : undefined
}

export function normalizeSandboxLogLineForOutput(
  timestamp: string,
  line: string
): PrintableSandboxLog[] {
  const log = JSON.parse(line)
  const dataEntries = parseDataEntries(log.data)

  if (!dataEntries) {
    return [normalizeSandboxLogForOutput(timestamp, log)]
  }

  return dataEntries.map((data) =>
    normalizeSandboxLogForOutput(timestamp, log, data)
  )
}

function normalizeSandboxLogForOutput(
  timestamp: string,
  sourceLog: Record<string, unknown>,
  data?: Record<string, unknown>
): PrintableSandboxLog {
  const log = { ...sourceLog }

  const level =
    normalizeLevel(
      getStringField(data?.level) ?? getStringField(data?.severity)
    ) ??
    normalizeLevel(getStringField(log.level)) ??
    LogLevel.INFO

  const logger = data
    ? (getStringField(data.logger) ?? getStringField(data.name))
    : getStringField(log.logger)
  if (logger) {
    log.logger = cleanLogger(logger)
  } else {
    delete log.logger
  }

  const message = getStringField(data?.message) ?? getStringField(data?.msg)
  if (message) {
    log.message = message
  }

  if (data) {
    const displayData = getDisplayData(data)
    if (displayData) {
      log.data = displayData
    } else {
      delete log.data
    }

    log.origin = 'user'
    const capturedBy = getCapturedBy(sourceLog)
    if (capturedBy) {
      log.captured_by = capturedBy
    }
    delete log.event_type
  }

  log.level = level
  delete log['traceID']
  delete log['instanceID']
  delete log['source_type']
  delete log['teamID']
  delete log['source']
  delete log['service']
  delete log['envID']
  delete log['sandboxID']

  return { timestamp, level, log }
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

          if (!opts?.follow) break

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
  const printableLogs = normalizeSandboxLogLineForOutput(timestamp, line)

  for (const printableLog of printableLogs) {
    printNormalizedLog(printableLog, allowedLevel, format, allowedLoggers)
  }
}

function printNormalizedLog(
  printableLog: PrintableSandboxLog,
  allowedLevel: LogLevel | undefined,
  format: Format | undefined,
  allowedLoggers?: string[] | undefined
) {
  const { timestamp, level } = printableLog
  const log = { ...printableLog.log }
  const logger = getStringField(log.logger) ?? ''
  const allowedLoggerPrefixes = allowedLoggers
    ?.map((allowedLogger) => allowedLogger.trim())
    .filter(Boolean)

  if (
    allowedLoggerPrefixes !== undefined &&
    allowedLoggerPrefixes.length > 0 &&
    !allowedLoggerPrefixes.some((allowedLogger) =>
      logger.startsWith(allowedLogger)
    )
  ) {
    return
  }

  if (!isLevelIncluded(level, allowedLevel)) {
    return
  }

  let formattedLevel: string = level
  switch (level) {
    case LogLevel.DEBUG:
      formattedLevel = chalk.default.black(chalk.default.bgWhite(level))
      break
    case LogLevel.INFO:
      formattedLevel = chalk.default.black(chalk.default.bgGreen(level) + ' ')
      break
    case LogLevel.WARN:
      formattedLevel = chalk.default.black(chalk.default.bgYellow(level) + ' ')
      break
    case LogLevel.ERROR:
      formattedLevel = chalk.default.white(chalk.default.bgRed(level))
      break
  }

  if (format === Format.JSON) {
    console.log(
      JSON.stringify({
        timestamp: new Date(timestamp).toISOString(),
        ...log,
      })
    )
  } else {
    const time = `[${new Date(timestamp).toISOString().replace(/T/, ' ')}]`
    delete log['level']
    console.log(
      `${asTimestamp(time)} ${formattedLevel} ` +
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
