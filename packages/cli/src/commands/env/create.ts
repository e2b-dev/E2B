import * as chalk from 'chalk'
import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'

import { client, ensureAPIKey } from 'src/api'
import {
  configName,
  configSchema,
  DevbookConfig,
  getConfigPath,
  randomTitle,
  saveConfig,
} from 'src/config'
import { templates } from 'src/config/template'
import { pathOption } from 'src/options'
import { ensureDir, getRoot } from 'src/utils/filesystem'
import {
  asTemplate,
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'

export const createCommand = new commander.Command('create')
  .description(`Create new environment and ${asLocal(configName)} config`)
  .option(
    '-T, --template <template>',
    `Use ${asBold('<template>')} as a base for the environment`,
  )
  .option('-t, --title <title>', `Use ${asBold('<title>')} as environment title`)
  .option('-n, --no-config', `Skip creating ${asLocal(configName)} config`)
  .addOption(pathOption)
  .alias('cr')
  .action(async opts => {
    try {
      const apiKey = ensureAPIKey()
      process.stdout.write('\n')

      const root = getRoot(opts.path)
      const configPath = getConfigPath(root)

      let template = opts.template as string | undefined
      let title = opts.title as string | undefined

      if (opts.config) {
        if (fs.existsSync(configPath)) {
          throw new Error(
            `Devbook config on path ${asLocalRelative(
              configPath,
            )} already exists - cannot create new config`,
          )
        }
      }

      const inquirer = await import('inquirer')
      if (!template) {
        const envsAnwsers = await inquirer.default.prompt([
          {
            name: 'template',
            message: chalk.default.underline('Choose base template for environment'),
            type: 'list',
            choices: templates,
          },
        ])
        template = envsAnwsers['template'] as string
      }

      if (!title) {
        const envsAnwsers = await inquirer.default.prompt([
          {
            name: 'title',
            message: chalk.default.underline('Choose title for environment'),
            type: 'input',
            default: path.basename(root),
          },
        ])
        title = (envsAnwsers['title'] as string | undefined) || randomTitle()
      }

      if (opts.config) {
        console.log(
          `Creating new environment titled "${title}" from ${asTemplate`[${template}]`} template with config ${asLocalRelative(
            configPath,
          )}`,
        )
      } else {
        console.log(
          `Creating new environment titled "${title}" from ${asTemplate`[${template}]`} template`,
        )
      }

      const config = await createEnvironment({
        template,
        title,
        apiKey,
        root,
        shouldSaveConfig: opts.config,
      })
      console.log(
        `Environment ${asFormattedEnvironment(
          config,
          opts.config ? configPath : undefined,
        )} created\n`,
      )
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function createEnvironment({
  template,
  title,
  apiKey,
  root,
  shouldSaveConfig,
}: {
  template: string
  title?: string
  root: string
  apiKey: string
  shouldSaveConfig: boolean
}): Promise<DevbookConfig> {
  const env = await createEnv({
    template,
    title,
    api_key: apiKey,
  })

  if (!env.ok) {
    throw new Error(
      `Failed to create new environment for template ${asTemplate`[${template}]`}`,
    )
  }

  const config = configSchema.cast(env.data) as DevbookConfig

  if (shouldSaveConfig) {
    await ensureDir(root)
    const configPath = getConfigPath(root)
    await saveConfig(configPath, config)
  }

  return config
}

const createEnv = client.path('/envs').method('post').create({ api_key: true })
