import * as commander from '@commander-js/extra-typings'
import { NotFoundError, Sandbox } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { Format, parseFormat } from 'src/options'
import { asBold } from 'src/utils/format'

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
  metadata: 'Metadata',
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
    'output format, eg. json, pretty',
    parseFormat,
    Format.PRETTY
  )
  .action(async (sandboxID, options) => {
    try {
      const apiKey = ensureAPIKey()
      const info = await Sandbox.getInfo(sandboxID, { apiKey })

      if (options.format === Format.PRETTY) {
        renderPrettyInfo(info as unknown as Record<string, unknown>)
      } else {
        console.log(JSON.stringify(info, null, 2))
      }
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
        process.exit(1)
        return
      }
      console.error(err)
      process.exit(1)
    }
  })

function renderPrettyInfo(info: Record<string, unknown>) {
  console.log(
    `\nSandbox info for ${asBold(String(info.sandboxId ?? 'unknown'))}:`
  )

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
