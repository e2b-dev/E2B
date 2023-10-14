import * as chalk from 'chalk'
import * as commander from 'commander'
import * as e2b from '@e2b/sdk'

import { ensureAccessToken } from 'src/api'
import { asFormattedError } from 'src/utils/format'

const listEnvs = e2b.withAccessToken(e2b.api.path('/envs').method('get').create())

export const listCommand = new commander.Command('list')
  .description('List environments')
  .alias('ls')
  .action(async () => {
    try {
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      const envsResponse = await listEnvs(accessToken, {})

      console.log(chalk.default.underline(chalk.default.green('Environments')))

      const envs = envsResponse.data

      if (!envs?.length) {
        console.log('No environments found')
      } else {
        envs
          .sort((a, b) => a.envID.localeCompare(b.envID))
          .forEach((env: { envID: string }) => {
            console.log(env.envID)
          })
      }

      process.stdout.write('\n')
    } catch (err: unknown) {
      console.error(asFormattedError((err as Error).message))
      process.exit(1)
    }
  })
