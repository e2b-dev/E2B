import * as commander from 'commander'
import { Secret } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import { renderTable } from 'src/utils/table'
import { parseMetadata } from '../sandbox/utils'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

// Secret values are write-only — never returned by the API — so they are
// never printed. Only the secret's ID/name/version/metadata/timestamps are.
export function formatSecretRow(secret: {
  secretId: string
  name: string
  version: number
  metadata: Record<string, string>
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...secret,
    createdAt: new Date(secret.createdAt).toLocaleString(),
    updatedAt: new Date(secret.updatedAt).toLocaleString(),
    metadata: JSON.stringify(secret.metadata),
  }
}

export const createCommand = new commander.Command('create')
  .description('create a new secret')
  .argument(
    '<name>',
    `name for the secret, unique within the project, eg. ${asBold('API_KEY')}`
  )
  .requiredOption(
    '-v, --value <value>',
    'secret value (write-only — never returned by the API)'
  )
  .option(
    '-m, --metadata <metadata>',
    'metadata to store with the secret, eg. key1=value1',
    (value, prev: string[]) => [...(prev ?? []), value],
    []
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(
    async (
      name: string,
      options: {
        value: string
        metadata?: string[]
        format?: string
      }
    ) => {
      try {
        const apiKey = ensureAPIKey()
        const metadata = parseMetadata(options.metadata?.join(','))

        const info = await Secret.create(name, options.value, {
          apiKey,
          metadata,
        })

        if (options.format === 'json') {
          console.log(JSON.stringify(info, null, 2))
        } else {
          console.log(
            `Created secret ${asBold(info.name)} (ID: ${asBold(info.secretId)}, version ${info.version})`
          )
        }
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

export const listCommand = new commander.Command('list')
  .description('list all secrets')
  .alias('ls')
  .option(
    '-l, --limit <limit>',
    `limit the number of secrets returned (default: ${DEFAULT_LIMIT}, 0 for no limit)`,
    (value: string) => parseInt(value)
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (options: { limit?: number; format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const format = options.format || 'pretty'
      const limit =
        options.limit === 0 ? undefined : (options.limit ?? DEFAULT_LIMIT)

      let pageLimit = limit
      if (!limit || limit > PAGE_LIMIT) {
        pageLimit = PAGE_LIMIT
      }

      const secrets: Awaited<ReturnType<typeof Secret.getInfo>>[] = []
      const paginator = Secret.list({ apiKey, limit: pageLimit })

      while (paginator.hasNext && (!limit || secrets.length < limit)) {
        const batch = await paginator.nextItems()
        secrets.push(...batch)
      }

      const trimmed = limit ? secrets.slice(0, limit) : secrets

      if (format === 'json') {
        console.log(JSON.stringify(trimmed, null, 2))
      } else {
        if (!trimmed.length) {
          console.log('No secrets found')
          return
        }

        renderTable(trimmed.map(formatSecretRow), [
          { header: 'Secret ID', value: (row) => row.secretId },
          { header: 'Name', value: (row) => row.name },
          { header: 'Version', value: (row) => String(row.version) },
          { header: 'Created at', value: (row) => row.createdAt },
          { header: 'Updated at', value: (row) => row.updatedAt },
          { header: 'Metadata', value: (row) => row.metadata },
        ])
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export const infoCommand = new commander.Command('info')
  .description('show details for a secret (by ID or name)')
  .argument('<secret>', `the secret ${asBold('<secretID>')} or name`)
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (secret: string, options: { format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const info = await Secret.getInfo(secret, { apiKey })

      if (options.format === 'json') {
        console.log(JSON.stringify(info, null, 2))
      } else {
        console.log(`Secret ID:  ${asBold(info.secretId)}`)
        console.log(`Name:       ${asBold(info.name)}`)
        console.log(`Version:    ${info.version}`)
        console.log(`Created at: ${new Date(info.createdAt).toLocaleString()}`)
        console.log(`Updated at: ${new Date(info.updatedAt).toLocaleString()}`)
        console.log(`Metadata:   ${JSON.stringify(info.metadata)}`)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export const updateCommand = new commander.Command('update')
  .description("update a secret's value, storing it as a new version")
  .argument('<secret>', `the secret ${asBold('<secretID>')} or name`)
  .requiredOption(
    '-v, --value <value>',
    'new secret value (write-only — never returned by the API)'
  )
  .option(
    '-m, --metadata <metadata>',
    'metadata to replace the stored metadata, eg. key1=value1',
    (value, prev: string[]) => [...(prev ?? []), value],
    []
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(
    async (
      secret: string,
      options: {
        value: string
        metadata?: string[]
        format?: string
      }
    ) => {
      try {
        const apiKey = ensureAPIKey()
        const metadata = parseMetadata(options.metadata?.join(','))

        const info = await Secret.update(secret, options.value, {
          apiKey,
          metadata,
        })

        if (options.format === 'json') {
          console.log(JSON.stringify(info, null, 2))
        } else {
          console.log(
            `Updated secret ${asBold(info.name)} (ID: ${asBold(info.secretId)}, version ${info.version})`
          )
        }
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

export const deleteCommand = new commander.Command('delete')
  .description('delete a secret, making all its versions inaccessible')
  .argument('<secret>', `the secret ${asBold('<secretID>')} or name to delete`)
  .alias('rm')
  .action(async (secret: string) => {
    try {
      const apiKey = ensureAPIKey()
      const destroyed = await Secret.destroy(secret, { apiKey })

      if (destroyed) {
        console.log(`Secret ${asBold(secret)} has been deleted`)
      } else {
        console.error(`Secret ${asBold(secret)} wasn't found`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
