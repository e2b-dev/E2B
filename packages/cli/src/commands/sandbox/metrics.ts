import * as chalk from 'chalk'
import * as commander from 'commander'
import * as e2b from 'e2b'

import { client, connectionConfig } from 'src/api'
import { asBold, asTimestamp, withUnderline } from 'src/utils/format'
import { wait } from 'src/utils/wait'
import { handleE2BRequestError } from '../../utils/errors'
import { listSandboxes } from './list'
import { formatEnum, getShortID, Format } from './utils'

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
    `specify format for printing logs (${formatEnum(Format)})`,
    Format.PRETTY
  )
  .action(
    async (
      sandboxID: string,
      opts?: {
        follow: boolean
        format: Format
      }
    ) => {
      try {
        const format = opts?.format.toLowerCase() as Format | undefined
        if (format && !Object.values(Format).includes(format)) {
          throw new Error(`Invalid log format: ${format}`)
        }

        let start : string | undefined
        let isFirstRun = true
        let firstMetricsPrinted = false

        if (format === Format.PRETTY) {
          console.log(`\nMetrics for sandbox ${asBold(sandboxID)}:`)
        }

        const isRunningPromise = listSandboxes()
          .then((r) => r.find((s) => s.sandboxID === getShortID(sandboxID)))
          .then((s) => !!s)

        do {
          const metrics = await getSandboxMetrics({ sandboxID, start })

          if (metrics.length !== 0 && !firstMetricsPrinted) {
            firstMetricsPrinted = true
            process.stdout.write('\n')
          }

          for (const metric of metrics) {
            if (start && metric.timestamp <= start) {
              // Skip the metric if it has the same timestamp as the last one
              continue
            }
            start = metric.timestamp

            printMetric(metric.timestamp, JSON.stringify(metric), format)
          }

          const isRunning = await isRunningPromise

          if (!isRunning && metrics.length === 0 && isFirstRun) {
            if (format === Format.PRETTY) {
              console.log(
                `\nStopped printing metrics — sandbox ${withUnderline(
                  'not found'
                )}`
              )
            }
            break
          }

          if (!isRunning) {
            if (format === Format.PRETTY) {
              console.log(
                `\nStopped printing metrics — sandbox is ${withUnderline(
                  'closed'
                )}`
              )
            }
            break
          }

          await wait(400)
          isFirstRun = false
        } while (opts?.follow)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

function printMetric(
  timestamp: string,
  line: string,
  format: Format | undefined
) {
  const metric = JSON.parse(line)
  const level = chalk.default.green()

  if (format === Format.JSON) {
    console.log(
      JSON.stringify({
        timestamp: new Date(timestamp).toISOString(),
        ...metric,
      })
    )
  } else {
    const time = `[${new Date(timestamp).toISOString().replace(/\.\d{3}Z/, 'Z').replace(/T/, ' ')}]`
    delete metric['timestamp']
    const multipleCores = metric.cpuCount > 1
    metric.cpuCount += 0
    console.log(
      `${asTimestamp(time)} ${level} ` +
        asBold('CPU') + `: ${(metric.cpuUsedPct).toString().padStart(5)}% / ${metric.cpuCount.toString().padStart(2)} Core${multipleCores && 's'} | ` +
        asBold('Memory') + `: ${(metric.memUsed >>> 20).toString().padStart(5)} / ${(metric.memTotal >>> 20).toString().padEnd(5)} MiB | ` +
        asBold('Disk') + `: ${(metric.diskUsed >>> 20).toString().padStart(5)} / ${(metric.diskTotal >>> 20).toString().padEnd(5)} MiB`
    )
  }
}

export async function getSandboxMetrics({
  sandboxID,
  start,
}: {
  sandboxID: string
  start?: string
}): Promise<e2b.components['schemas']['SandboxMetric'][]> {
  const signal = connectionConfig.getSignal()
  const res = await client.api.GET('/sandboxes/{sandboxID}/metrics', {
    signal,
    params: {
      path: {
        sandboxID,
        start,
      },
    },
  })

  handleE2BRequestError(res, 'Error while getting sandbox metrics')

  return res.data as unknown as e2b.components['schemas']['SandboxMetric'][]
}
