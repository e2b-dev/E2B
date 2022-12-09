import * as sdk from '@devbookhq/sdk'
import * as commander from 'commander'

import { client, ensureAPIKey } from 'src/api'
import { envPathArgument } from 'src/arguments'
import { loadConfigs } from 'src/config'
import { confirm } from 'src/interactions/confirm'
import { getPromptEnvs } from 'src/interactions/envs'
import { allOption, idOption, selectOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { formatEnvironment } from 'src/utils/format'
import { listEnvironments } from './list'

export const publishCommand = new commander.Command('publish')
  .description('Make the latest version of an environment publicly available')
  .addArgument(envPathArgument)
  .addOption(idOption)
  .addOption(selectOption)
  .addOption(allOption)
  .action(async (envPath, cmdObj) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(envPath)

      let envs: sdk.components['schemas']['Environment'][] | undefined

      if (cmdObj.id) {
        envs = [cmdObj.id]
      } else if (cmdObj.select) {
        const allEnvs = await listEnvironments({ apiKey })
        envs = await getPromptEnvs(allEnvs)
      } else {
        const localConfigs = await loadConfigs(root, cmdObj.all)
        if (localConfigs.length > 0) {
          envs = localConfigs
        }
      }

      if (!envs || envs.length === 0) {
        console.log('No environments found')
        return
      }

      envs.forEach(e => `- Environment "${formatEnvironment(e)}" is ready to publish`)

      const confirmed = await confirm(
        `Do you really want to publish ${
          envs.length === 1 ? 'the environment' : 'environments'
        }?`,
        true,
      )

      if (!confirmed) {
        console.log('Canceled')
        return
      }

      await Promise.all(
        envs.map(async e => {
          console.log(`- Publishing environment "${formatEnvironment(e)}"...`)
          await publishEnvironment({ apiKey, id: e.id })
        }),
      )

      console.log('Done')
    } catch (err) {
      console.error(err)
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
