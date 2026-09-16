import * as commander from 'commander'
import { NotFoundError, Sandbox, SidecarInfo } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import { formatTable } from 'src/utils/table'

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
  sidecars: 'Sidecars',
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
  'sidecars',
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
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (sandboxID: string, options: { format?: string }) => {
    try {
      const format = options.format || 'pretty'
      const apiKey = ensureAPIKey()
      const info = await Sandbox.getInfo(sandboxID, { apiKey })

      if (format === 'pretty') {
        renderPrettyInfo(info as unknown as Record<string, unknown>)
      } else if (format === 'json') {
        console.log(JSON.stringify(info, null, 2))
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
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

export function renderPrettyInfo(info: Record<string, unknown>) {
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

    if (key === 'sidecars' && Array.isArray(value) && value.length === 0) {
      continue
    }

    const label = fieldLabels[key] ?? key
    const formattedValue =
      key === 'sidecars' && Array.isArray(value)
        ? formatSidecarTable(value).join('\n')
        : formatValue(value)

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

export function formatSidecarTable(sidecars: SidecarInfo[]): string[] {
  return formatTable(sidecars, [
    { header: 'Entry', value: (sidecar) => sidecar.entry },
    { header: 'Version', value: (sidecar) => sidecar.version },
    { header: 'Role', value: (sidecar) => sidecar.role },
    { header: 'Class', value: (sidecar) => sidecar.class },
    { header: 'State', value: (sidecar) => sidecar.state },
    { header: 'Name', value: (sidecar) => sidecar.name },
    { header: 'Address', value: (sidecar) => sidecar.address },
    { header: 'Ports', value: (sidecar) => sidecar.ports?.join(',') },
    {
      header: 'Last error',
      value: (sidecar) => truncate(sidecar.lastError, LAST_ERROR_WIDTH),
    },
  ])
}

const LAST_ERROR_WIDTH = 60

function truncate(value: string | undefined, width: number) {
  if (value === undefined || value.length <= width) {
    return value
  }
  return `${value.slice(0, width - 1)}…`
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
