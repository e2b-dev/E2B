import * as commander from 'commander'
import { stringify as stringifyYaml } from 'yaml'

export enum OutputFormat {
  PRETTY = 'pretty',
  JSON = 'json',
  YAML = 'yaml',
  NAME = 'name',
}

const outputFormatAliases: Record<string, OutputFormat> = {
  table: OutputFormat.PRETTY,
}

export const supportedOutputFormats = [
  OutputFormat.PRETTY,
  'table',
  OutputFormat.JSON,
  OutputFormat.YAML,
  OutputFormat.NAME,
].join(', ')

export const outputOption = new commander.Option(
  '-o, --output <format>',
  `output format (${supportedOutputFormats})`
).argParser(parseOutputFormat)

export const formatOption = new commander.Option(
  '-f, --format <format>',
  `deprecated alias for --output (${supportedOutputFormats})`
).argParser(parseOutputFormat)

export function resolveOutputFormat(options: {
  output?: string | OutputFormat
  format?: string | OutputFormat
}): OutputFormat {
  const rawFormat = options.output ?? options.format ?? OutputFormat.PRETTY
  return parseOutputFormat(rawFormat)
}

function parseOutputFormat(rawFormat: string): OutputFormat {
  const normalized = rawFormat.toLowerCase()
  const format = outputFormatAliases[normalized] ?? (normalized as OutputFormat)

  if (!Object.values(OutputFormat).includes(format)) {
    throw new commander.InvalidArgumentError(
      `Unsupported output format: ${rawFormat}. Supported formats: ${supportedOutputFormats}`
    )
  }

  return format
}

export function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2))
}

export function printYaml(data: unknown) {
  process.stdout.write(stringifyYaml(data))
}

export function printNames<T>(items: T[], nameFromItem: (item: T) => string) {
  for (const item of items) {
    console.log(nameFromItem(item))
  }
}
