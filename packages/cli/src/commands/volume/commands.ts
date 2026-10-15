import * as commander from 'commander'
import { Volume } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import { renderTable } from 'src/utils/table'

export const createCommand = new commander.Command('create')
  .description('create a new volume')
  .argument('<name>', `name for the volume, eg. ${asBold('my-volume')}`)
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (name: string, options: { format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const volume = await Volume.create(name, { apiKey })

      const info = {
        volumeId: volume.volumeId,
        name,
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(info, null, 2))
      } else {
        console.log(
          `Created volume ${asBold(info.name)} (ID: ${asBold(info.volumeId)})`
        )
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export const listCommand = new commander.Command('list')
  .description('list all volumes')
  .alias('ls')
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (options: { format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const volumes = await Volume.list({ apiKey })

      if (options.format === 'json') {
        console.log(JSON.stringify(volumes, null, 2))
      } else {
        if (!volumes.length) {
          console.log('No volumes found')
          return
        }

        renderTable(volumes, [
          { header: 'Volume ID', value: (row) => row.volumeId },
          { header: 'Name', value: (row) => row.name },
        ])
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export const infoCommand = new commander.Command('info')
  .description('show details for a volume')
  .argument('<volumeID>', `the volume ${asBold('<volumeID>')}`)
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (volumeID: string, options: { format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const info = await Volume.getInfo(volumeID, { apiKey })

      if (options.format === 'json') {
        console.log(JSON.stringify(info, null, 2))
      } else {
        console.log(`Volume ID:  ${asBold(info.volumeId)}`)
        console.log(`Name:       ${asBold(info.name)}`)
        if (info.domain) {
          console.log(`Domain:     ${info.domain}`)
        }
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export const deleteCommand = new commander.Command('delete')
  .description('delete a volume')
  .argument('<volumeID>', `the volume ${asBold('<volumeID>')} to delete`)
  .alias('rm')
  .action(async (volumeID: string) => {
    try {
      const apiKey = ensureAPIKey()
      const destroyed = await Volume.destroy(volumeID, { apiKey })

      if (destroyed) {
        console.log(`Volume ${asBold(volumeID)} has been deleted`)
      } else {
        console.error(`Volume ${asBold(volumeID)} wasn't found`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
