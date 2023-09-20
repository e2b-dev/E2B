import * as chalk from 'chalk'
import * as commander from 'commander'
import { apiBaseUrl, ensureAccessToken } from 'src/api'
import { asFormattedError } from 'src/utils/format'
import { sortEnvs } from 'src/utils/sort'

export const listCommand = new commander.Command('list')
  .description('List environments')
  .alias('ls')
  .action(async () => {
    try {
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      // TODO: Use client
      // const envs = await client.path('/envs').method('get').create()({ accessToken }).data
      const apiRes = await fetch(`${apiBaseUrl}/envs`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const envs = await apiRes.json()

      console.log(chalk.default.underline(chalk.default.green('Environments')))

      if (!envs?.length) {
        console.log('No environments found')
      } else {
        envs.sort(sortEnvs).forEach((env: { envID: string }) => {
          console.log(env.envID)
        })
      }

      process.stdout.write('\n')
    } catch (err: unknown) {
      console.error(asFormattedError((err as Error).message))
      process.exit(1)
    }
  })
