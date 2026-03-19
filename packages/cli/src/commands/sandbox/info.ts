import * as commander from 'commander'
import { Sandbox } from 'e2b'

import { ensureAPIKey } from '../../api'
import { asBold } from 'src/utils/format'
import { formatEnum, Format } from './utils'

const fieldLabels: Partial<Record<string, string>> = {
  sandboxId: 'Sandbox ID',
  templateId: 'Template ID',
  name: 'Alias',
  startedAt: 'Started at',
  endAt: 'End at',
  state: 'State',
  cpuCount: 'vCPUs',
  memoryMB: 'RAM MiB',
  envdVersion: 'Envd version',
  allowInternetAccess: 'Internet access',
  lifecycle: 'Lifecycle',
  network: 'Network',
  sandboxDomain: 'Sandbox domain',
  envdAccessToken: 'Envd access token',
}

const fieldOrder = [
  'sandboxId',
  'templateId',
  'name',
  'state',
  'startedAt',
  'endAt',
  'cpuCount',
  'memoryMB',
  'envdVersion',
  'allowInternetAccess',
  'lifecycle',
  'network',
  'sandboxDomain',
  'metadata',
]

export const infoCommand = new commander.Command('info')
  .description('show information for a sandbox')
  .argument(
    '<sandboxID>',
    `show information for sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('in')
  .option(
    '-f, --format <format>',
    `specify format for printing sandbox info (${formatEnum(Format)})`,
    Format.PRETTY
  )
  .action(
    async (
      sandboxID: string,
      opts?: {
        format: Format
      }
    ) => {
      try {
        const format = opts?.format?.toLowerCase() as Format | undefined
        if (format && !Object.values(Format).includes(format)) {
          throw new Error(`Invalid info format: ${format}`)
        }

        const apiKey = ensureAPIKey()
        const info = await Sandbox.getInfo(sandboxID, { apiKey })

        if (format === Format.JSON) {
          console.log(JSON.stringify(info, null, 2))
          return
        }

        renderPrettyInfo(info as unknown as Record<string, unknown>)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

function renderPrettyInfo(info: Record<string, unknown>) {
  console.log(`\nSandbox info for ${asBold(String(info.sandboxId ?? 'unknown'))}:`)

  const orderedKeys = [
    ...fieldOrder.filter((key) => key in info),
    ...Object.keys(info).filter((key) => !fieldOrder.includes(key)),
  ]

  for (const key of orderedKeys) {
    const value = info[key]
    if (value === undefined) {
      continue
    }

    const label = fieldLabels[key] ?? key
    const formattedValue = formatValue(value)

    if (formattedValue.includes('\n')) {
      const indentedValue = formattedValue
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')
      console.log(`${asBold(label)}:\n${indentedValue}`)
      continue
    }

    console.log(`${asBold(label)}: ${formattedValue}`)
  }

  process.stdout.write('\n')
}

function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toLocaleString()
  }

  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}
