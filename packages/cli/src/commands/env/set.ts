import * as sdk from '@devbookhq/sdk'
import * as chalk from 'chalk'
import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { idArgument } from 'src/arguments'
import { getPromptEnv, getRootEnv } from 'src/interactions/envs'
import { pathOption, selectOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocalRelative,
} from 'src/utils/format'
import { listEnvironments } from './list'

const envVarScriptPath = '/etc/profile.d/env-vars.sh'

export const setCommand = new commander.Command('set')
  .description('Set env vars in environment')
  .addArgument(idArgument)
  .addOption(selectOption)
  .addOption(pathOption)
  .option(
    '-e, --env-vars <KEY=VALUE...>',
    `Set provided ${asBold('<KEY=VALUE...>')} pairs as env vars in environment`,
  )
  .alias('st')
  .action(async (id, opts) => {
    try {
      const apiKey = ensureAPIKey()
      process.stdout.write('\n')

      const root = getRoot(opts.path)
      let isLocal = false

      let env: sdk.components['schemas']['Environment'] | undefined
      if (id) {
        env = { id }
      } else if (opts.select) {
        const envs = await listEnvironments({ apiKey })
        env = await getPromptEnv(envs, 'Select environment to set vars in')
      } else {
        env = await getRootEnv(root)
        if (env) {
          isLocal = true
        }
      }

      if (!env) {
        console.log(`No environments found in ${asLocalRelative(root)}`)
        return
      }

      if (!opts.envVars || opts.envVars.length === 0) {
        console.log('No env vars provided')
        return
      }

      const invalidEnvVars = (opts.envVars as string[]).filter(e => e.indexOf('=') === -1)
      if (invalidEnvVars.length > 0) {
        console.log(
          chalk.default.underline(
            `The following ${
              invalidEnvVars.length === 1 ? 'env var is' : 'env vars are'
            } missing ${asBold('=')} betwen the ${asBold('KEY')} and ${asBold('VALUE')}:`,
          ),
        )

        invalidEnvVars.forEach(e =>
          console.log('- ' + chalk.default.bold(chalk.default.red(e)) + '\n'),
        )

        return
      }

      console.log(
        `Setting ${opts.envVars.length} env ${
          opts.envVars.length === 1 ? 'var' : 'vars'
        } in environment ${asFormattedEnvironment(env, isLocal ? root : undefined)}`,
      )

      await setEnvVars({
        apiKey,
        config: env,
        published: !!opts.published,
        envVars: opts.envVars,
      })

      console.log(
        `${opts.envVars.length} env ${
          opts.envVars.length === 1 ? 'var' : 'vars'
        } in environment ${asFormattedEnvironment(
          env,
          isLocal ? root : undefined,
        )} set\n`,
      )

      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function setEnvVars({
  apiKey,
  config,
  envVars,
  published,
}: {
  envVars: string[]
  apiKey: string
  config: sdk.components['schemas']['Environment']
  published: boolean
}) {
  const session = new sdk.Session({
    apiKey,
    editEnabled: !published,
    id: config.id,
  })

  try {
    await session.open()

    const envsString = envVars.map(envVar => `export ${envVar}`).join('\n')

    await session.filesystem?.write(envVarScriptPath, envsString)
  } finally {
    // Don't call close - the edit session is shared so we don't want to close it.
    // await session.close()
  }
}
