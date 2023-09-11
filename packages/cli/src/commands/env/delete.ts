import * as commander from 'commander'
import * as sdk from '@e2b/sdk'
import * as chalk from 'chalk'

import { client, ensureAPIKey } from 'src/api'
import { confirm } from 'src/interactions/confirm'
import { getPromptEnvs } from 'src/interactions/envs'
import { listEnvironments } from './list'
import {
  asFormattedEnvironment,
  asFormattedError,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import { allOption, pathOption, selectMultipleOption } from 'src/options'
import { configName, deleteConfig, loadConfigs } from 'src/config'
import { getRoot } from 'src/utils/filesystem'
import { idsArgument } from 'src/arguments'

export const deleteCommand = new commander.Command('delete')
  .description(`Delete environment and ${asLocal(configName)} config`)
  .addArgument(idsArgument)
  .addOption(selectMultipleOption)
  .addOption(pathOption)
  .addOption(allOption)
  .alias('dl')
  .option(
    '-k, --keep-config',
    `Keep ${asLocal(configName)} config in local filesystem after deleting environment`,
  )
  .option('-y, --yes', 'Skip manual delete confirmation')
  .action(async (ids, opts) => {
    try {
      const apiKey = ensureAPIKey()

      const root = getRoot(opts.path)

      let envs:
        | (sdk.components['schemas']['Environment'] & { configPath?: string })[]
        | undefined

      if (ids.length > 0) {
        envs = ids.map((id: string) => ({ id }))

        if (!envs || envs.length === 0) {
          console.log('No environments selected')
          return
        }
      } else if (opts.select) {
        const allEnvs = await listEnvironments({ apiKey })
        envs = await getPromptEnvs(allEnvs, 'Select environments to delete')

        if (!envs || envs.length === 0) {
          console.log('No environments selected')
          return
        }
      } else {
        const localConfigs = await loadConfigs(root, opts.all)
        if (localConfigs.length > 0) {
          envs = localConfigs
        }
        if (!envs || envs.length === 0) {
          console.log(
            `No environments found in ${asLocalRelative(root)}${
              opts.all ? ' and its subdirectories' : ''
            }`,
          )
          return
        }
      }

      console.log(chalk.default.red(chalk.default.underline('\nEnvironments to delete')))
      envs.forEach(e => console.log(asFormattedEnvironment(e, e.configPath)))
      process.stdout.write('\n')

      if (!opts.yes) {
        const confirmed = await confirm(
          `Do you really want to delete ${
            envs.length === 1 ? 'this environment' : 'these environments'
          }?`,
        )

        if (!confirmed) {
          console.log('Canceled')
          return
        }
      }

      await Promise.all(
        envs.map(async e => {
          console.log(`- Deleting environment ${asFormattedEnvironment(e, e.configPath)}`)
          await deleteEnvironment({ apiKey, id: e.id })
          if (!opts.keepConfig && e.configPath) {
            await deleteConfig(e.configPath)
          }
        }),
      )
      process.stdout.write('\n')
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function deleteEnvironment({ id, apiKey }: { id: string; apiKey: string }) {
  await deleteEnv({
    api_key: apiKey,
    codeSnippetID: id,
  })
}

const deleteEnv = client
  .path('/envs/{codeSnippetID}')
  .method('delete')
  .create({ api_key: true })
