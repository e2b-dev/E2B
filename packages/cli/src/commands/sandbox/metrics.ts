import * as chalk from 'chalk'
import * as commander from 'commander'
import * as e2b from 'e2b'
import * as util from 'util'

import { client, connectionConfig } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { wait } from 'src/utils/wait'
import { handleE2BRequestError } from '../../utils/errors'
import { listSandboxes } from './list'
import { waitForSandboxEnd } from './logs'

const maxRuntime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

function getShortID(sandboxID: string) {
  return sandboxID.split('-')[0]
}

function formatEnum(e: { [key: string]: string }) {
  return Object.values(e)
    .map((level) => asBold(level))
    .join(', ')
}

enum LogFormat {
  JSON = 'json',
  PRETTY = 'pretty',
}

function cleanLogger(logger?: string) {
  if (!logger) {
    return ''
  }

  return logger.replaceAll('Svc', '')
}

export const metricsCommand = new commander.Command('metrics')
  .description('show metrics for sandbox')
  .argument(
    '<sandboxID>',
    `show metrics for sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('mt')
  .option('-f, --follow', 'keep streaming metrics until the sandbox is closed')
  .option(
    '--format <format>',
    `specify format for printing metrics (${formatEnum(LogFormat)})`,
    LogFormat.PRETTY
  )
  .action(
    async (
      sandboxID: string,
      opts?: {
        level: string
        follow: boolean
        format: LogFormat
        loggers?: string[]
      }
    ) => {
      try {
        const format = opts?.format.toLowerCase() as LogFormat | undefined
        if (format && !Object.values(LogFormat).includes(format)) {
          throw new Error(`Invalid log format: ${format}`)
        }

        const getIsRunning = opts?.follow
          ? waitForSandboxEnd(sandboxID)
          : () => false

        let start: number | undefined
        let isFirstRun = true
        let firstMetricsPrinted = false

        if (format === LogFormat.PRETTY) {
          console.log(`\nMetrics for sandbox ${asBold(sandboxID)}:`)
        }

        const isRunningPromise = listSandboxes()
          .then((r) => r.find((s) => s.sandboxID === getShortID(sandboxID)))
          .then((s) => !!s)

        do {
          const metrics = await getSandboxMetrics({ sandboxID })

          if (metrics.length !== 0 && firstMetricsPrinted === false) {
            firstMetricsPrinted = true
            process.stdout.write('\n')
          }

          for (const metric of metrics) {
            printMetric(metric.timestamp, JSON.stringify(metric), format)
          }

          const isRunning = await isRunningPromise

          if (!isRunning && metrics.length === 0 && isFirstRun) {
            if (format === LogFormat.PRETTY) {
              console.log(
                `\nStopped printing metrics — sandbox ${withUnderline(
                  'not found'
                )}`
              )
            }
            break
          }

          if (!isRunning) {
            if (format === LogFormat.PRETTY) {
              console.log(
                `\nStopped printing metrics — sandbox is ${withUnderline(
                  'closed'
                )}`
              )
            }
            break
          }

          const lastMetric =
            metrics.length > 0 ? metrics[metrics.length - 1] : undefined
          if (lastMetric) {
            // TODO: Use the timestamp from the last metric instead of the current time?
            start = new Date(lastMetric.timestamp).getTime() + 1
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

function printMetric(
  timestamp: string,
  line: string,
  format: LogFormat | undefined
) {
  const metric = JSON.parse(line)
  const level = chalk.default.green()

  metric.logger = cleanLogger(metric.logger)

  delete metric['traceID']
  delete metric['instanceID']
  delete metric['source_type']
  delete metric['teamID']
  delete metric['source']
  delete metric['service']
  delete metric['envID']
  delete metric['sandboxID']
  delete metric['logger']

  if (format === LogFormat.JSON) {
    console.log(
      JSON.stringify({
        timestamp: new Date(timestamp).toISOString(),
        level,
        ...metric,
      })
    )
  } else {
    const time = `[${new Date(timestamp).toISOString().replace(/T/, ' ')}]`
    delete metric['level']
    console.log(
      `${asTimestamp(time)} ${level} ` +
        util.inspect(metric, {
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

export async function getSandboxMetrics({
  sandboxID,
}: {
  sandboxID: string
}): Promise<e2b.components['schemas']['SandboxMetric'][]> {
  const signal = connectionConfig.getSignal()
  const res = await client.api.GET('/sandboxes/{sandboxID}/metrics', {
    signal,
    params: {
      path: {
        sandboxID,
      },
    },
  })

  handleE2BRequestError(res.error, 'Error while getting sandbox metrics')

  return res.data as e2b.components['schemas']['SandboxMetric'][]
}
