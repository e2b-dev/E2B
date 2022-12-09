import * as sdk from '@devbookhq/sdk'
import * as commander from 'commander'
import * as fs from 'fs'

import { ensureAPIKey } from 'src/api'
import {
  configSchema,
  DevbookConfig,
  saveConfig,
  configName,
  getConfigPath,
} from 'src/config'
import { listEnvironments } from './list'
import { getRoot, ensureDir } from 'src/utils/filesystem'
import { envPathArgument } from 'src/arguments'
import { idOption, selectOption } from 'src/options'
import { getPromptEnv } from 'src/interactions/envs'
import { formatEnvironment } from 'src/utils/format'
import { spinner } from 'src/interactions/spinner'

export const useCommand = new commander.Command('use')
  .description(
    `Reinitialize an existing environment, creating "${configName}" config for the environment in the filesystem`,
  )
  .addArgument(envPathArgument)
  .addOption(selectOption)
  .addOption(idOption)
  .action(async (envPath, cmdObj) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(envPath)

      const configPath = getConfigPath(root)
      if (fs.existsSync(configPath)) {
        throw new Error(
          `Devbook config on path "${configPath}" already exists - cannot create a new config`,
        )
      }

      let env: sdk.components['schemas']['Environment'] | undefined
      if (cmdObj.id) {
        env = { id: cmdObj.id }
      } else {
        const envs = await listEnvironments({ apiKey })
        env = await getPromptEnv(envs)
      }

      if (!env) {
        console.log('No environment found')
        return
      }

      spinner.text = `Reinitializing environment "${formatEnvironment(env, configPath)}"`

      spinner.start()
      await ensureDir(root)
      await useEnvironment({
        configPath,
        env,
      })
      spinner.stop()
      console.log('Done')
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

export async function useEnvironment({
  configPath,
  env,
}: {
  configPath: string
  env: sdk.components['schemas']['Environment']
}) {
  const configWithDefaults = configSchema.cast(env) as DevbookConfig

  await saveConfig(configPath, configWithDefaults)
}
