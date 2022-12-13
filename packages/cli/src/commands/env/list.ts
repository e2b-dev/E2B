import * as chalk from 'chalk'
import * as commander from 'commander'

import { client, ensureAPIKey } from 'src/api'
import { configName, getNestedConfigs, loadConfig } from 'src/config'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asFormattedEnvironment, asFormattedError, asLocal } from 'src/utils/format'
import { assertFulfilled, assertRejected } from 'src/utils/promise'
import { sortEnvs } from 'src/utils/sort'

export const listCommand = new commander.Command('list')
  .description('List available environments')
  .addOption(pathOption)
  .option(
    '-n, --no-local',
    `Don't scan local filesystem for environment ${asLocal(configName)} configs`,
  )
  .alias('ls')
  .action(async opts => {
    try {
      const apiKey = ensureAPIKey()
      process.stdout.write('\n')

      const root = getRoot(opts.path)

      const envsPromise = listEnvironments({ apiKey })
      const configsPromise = opts.local
        ? getNestedConfigs(root).then(configPaths =>
            Promise.allSettled(
              configPaths.map(async c => ({
                config: await loadConfig(c.path),
                configPath: c.path,
              })),
            ),
          )
        : Promise.resolve([])

      const [envs, configs] = await Promise.all([envsPromise, configsPromise])

      const fulfilledConfigs = configs.filter(assertFulfilled)

      console.log(chalk.default.underline(chalk.default.green('Environments')))

      envs.sort(sortEnvs).forEach(env => {
        const configIdx = fulfilledConfigs.findIndex(c => c.value.config.id === env.id)

        const config =
          configIdx > -1 ? fulfilledConfigs.splice(configIdx, 1).pop() : undefined

        console.log(asFormattedEnvironment(env, config?.value.configPath))
      })

      const rejectedConfigs = configs.filter(assertRejected)
      if (rejectedConfigs.length > 0) {
        rejectedConfigs.forEach(c => {
          console.error(asFormattedError(c.reason))
        })
      }

      if (fulfilledConfigs.length > 0) {
        console.log(
          chalk.default.underline(
            chalk.default.red('\nConfigs without existing environments'),
          ),
        )
        fulfilledConfigs.forEach(c => {
          console.log(asFormattedEnvironment(c.value.config, c.value.configPath))
        })
      }

      process.stdout.write('\n')
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function listEnvironments({ apiKey }: { apiKey: string }) {
  const result = await listEnvs({
    api_key: apiKey,
  })

  return result.data
}

const listEnvs = client.path('/envs').method('get').create()
