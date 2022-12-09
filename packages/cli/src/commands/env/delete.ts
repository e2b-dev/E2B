import * as commander from 'commander'
import * as sdk from '@devbookhq/sdk'

import { client, ensureAPIKey } from 'src/api'
import { confirm } from 'src/interactions/confirm'
import { getRootEnv, getPromptEnv } from 'src/interactions/envs'
import { listEnvironments } from './list'
import { formatEnvironment } from 'src/utils/format'
import { envPathArgument } from 'src/arguments'
import { idOption, selectOption } from 'src/options'
import { spinner } from 'src/interactions/spinner'
import { deleteConfig, getConfigPath } from 'src/config'
import { getRoot } from 'src/utils/filesystem'

export const deleteCommand = new commander.Command('delete')
  .description('Delete an environment')
  .addArgument(envPathArgument)
  .addOption(idOption)
  .addOption(selectOption)
  .option(
    '-d, --delete-config',
    'Delete the config in the local filesystem after deleting the environment',
  )
  .action(async (envPath, cmdObj) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(envPath)

      let env: sdk.components['schemas']['Environment'] | undefined

      let isConfigInRoot = false

      if (cmdObj.id) {
        env = cmdObj.id
      } else if (cmdObj.select) {
        const envs = await listEnvironments({ apiKey })
        env = await getPromptEnv(envs)
      } else {
        env = await getRootEnv(root)
        if (env) {
          isConfigInRoot = true
        }
      }

      if (!env) {
        console.log('No environment found')
        return
      }

      const confirmed = await confirm(
        `Do you really want to delete environment "${formatEnvironment(
          env,
          isConfigInRoot ? root : undefined,
        )}"?`,
      )

      if (!confirmed) {
        console.log('Canceled')
        return
      }

      spinner.text = `Deleting environment "${formatEnvironment(
        env,
        isConfigInRoot ? root : undefined,
      )}"`
      spinner.start()
      await deleteEnvironment({ apiKey, id: env.id })
      if (cmdObj.deleteConfig && isConfigInRoot) {
        const configPath = getConfigPath(root)
        await deleteConfig(configPath)
      }

      spinner.stop()
      console.log('Done')
    } catch (err) {
      console.error(err)
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
