import * as sdk from '@devbookhq/sdk'
import * as commander from 'commander'

import { client, ensureAPIKey } from 'src/api'
import { idsArgument } from 'src/arguments'
import { loadConfigs } from 'src/config'
import { getPromptEnvs } from 'src/interactions/envs'
import { allOption, pathOption, selectMultipleOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import {
  asFormattedEnvironment,
  asFormattedError,
  asLocalRelative,
} from 'src/utils/format'
import { listEnvironments } from './list'

export const publishCommand = new commander.Command('publish')
  .description('Make latest version of environment publicly available')
  .addArgument(idsArgument)
  .addOption(selectMultipleOption)
  .addOption(pathOption)
  .addOption(allOption)
  .alias('pb')
  .action(async (ids, opts) => {
    try {
      const apiKey = ensureAPIKey()
      process.stdout.write('\n')

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
        envs = await getPromptEnvs(allEnvs, 'Select environments to publish')

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

      await Promise.all(
        envs.map(async e => {
          console.log(
            `- Publishing environment ${asFormattedEnvironment(e, e.configPath)}`,
          )
          await publishEnvironment({ apiKey, id: e.id })
        }),
      )
      process.stdout.write('\n')
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function publishEnvironment({ id, apiKey }: { id: string; apiKey: string }) {
  await publishEnv({
    api_key: apiKey,
    codeSnippetID: id,
  })
}

const publishEnv = client
  .path('/envs/{codeSnippetID}')
  .method('patch')
  .create({ api_key: true })
