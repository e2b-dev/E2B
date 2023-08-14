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
import { pathOption, selectOption } from 'src/options'
import { getPromptEnv } from 'src/interactions/envs'
import {
  asFormattedEnvironment,
  asFormattedError,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import { idArgument } from 'src/arguments'

export const useCommand = new commander.Command('use')
  .description(`Create ${asLocal(configName)} config for existing environment`)
  .addArgument(idArgument)
  .addOption(selectOption)
  .alias('us')
  .addOption(pathOption)
  .action(async (id, opts) => {
    try {
      const apiKey = ensureAPIKey()
      process.stdout.write('\n')

      const root = getRoot(opts.path)

      const configPath = getConfigPath(root)
      if (fs.existsSync(configPath)) {
        throw new Error(
          `Devbook config ${asLocalRelative(
            configPath,
          )} already exists - cannot create config`,
        )
      }

      let env: sdk.components['schemas']['Environment'] | undefined
      const envs = await listEnvironments({ apiKey })
      if (id) {
        env = envs.find(e => e.id === id)
      } else {
        env = await getPromptEnv(
          envs,
          `Select environment to create ${asLocalRelative(configPath)} config for`,
        )
      }

      if (!env) {
        console.log('No environments found')
        return
      }

      console.log(
        `Creating config for environment ${asFormattedEnvironment(env, configPath)}`,
      )

      await ensureDir(root)
      await useEnvironment({
        configPath,
        env,
      })
      console.log(
        `Config for environment ${asFormattedEnvironment(env, configPath)} created`,
      )
      process.stdout.write('\n')
    } catch (err: any) {
      console.error(asFormattedError(err.message))
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
