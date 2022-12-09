import * as chalk from 'chalk'
import * as commander from 'commander'

import { client, ensureAPIKey } from 'src/api'
import { getNestedConfigs, loadConfig } from 'src/config'
import { spinner } from 'src/interactions/spinner'
import { getRoot } from 'src/utils/filesystem'
import { formatEnvironment, formatError } from 'src/utils/format'
import { sortEnvs } from 'src/utils/sort'

export const listCommand = new commander.Command('list')
  .description('List available environments')
  .option(
    '-l, --local [dirPath]',
    'Find local environments initialized in the current directory or in the specified "dirPath" directory and its nested directories.',
  )
  .action(async cmdObj => {
    try {
      const apiKey = ensureAPIKey()

      if (cmdObj.local === undefined) {
        spinner.text = 'Listing available environments'
        spinner.start()

        const envs = await listEnvironments({ apiKey })
        spinner.stop()

        if (envs.length === 0) {
          console.log('No environments available')
          return
        }

        console.log(chalk.default.underline(chalk.default.green('\nEnvironments')))

        envs.sort(sortEnvs).forEach(e => console.log(formatEnvironment(e)))
      } else {
        const dirPath = getRoot(cmdObj.local === true ? undefined : cmdObj.local)
        console.log(`Listing available local environments from "${dirPath}"...`)

        const configPaths = await getNestedConfigs(dirPath)

        const configs = await Promise.allSettled(
          configPaths.map(async c => {
            return await loadConfig(c.path)
          }),
        )

        console.log(chalk.default.underline(chalk.default.green('\nLocal environments')))
        for (let i = 0; i < configPaths.length; i++) {
          const configPath = configPaths[i]
          const config = configs[i]

          if (config.status === 'rejected') {
            console.log(
              formatError(
                `cannot access or validate config "${configPath.path}"`,
                config.reason,
              ),
            )
          } else {
            console.log(formatEnvironment(config.value, configPath.path))
          }
        }
      }
      console.log('\nDone')
    } catch (err) {
      console.error(err)
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
