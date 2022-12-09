import * as chalk from 'chalk'
import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'

import { client, ensureAPIKey } from 'src/api'
import { envPathArgument } from 'src/arguments'
import {
  configName,
  configSchema,
  DevbookConfig,
  getConfigPath,
  saveConfig,
} from 'src/config'
import { templates } from 'src/config/template'
import { spinner } from 'src/interactions/spinner'
import { ensureDir, getRoot } from 'src/utils/filesystem'
import { formatEnvironment } from 'src/utils/format'

export const initCommand = new commander.Command('init')
  .description(
    `Initialize a new environment based on a template and create a "${configName}" config for it in the filesystem. The environment must be published with the "env publish" command, before it is publicly available`,
  )
  .addArgument(envPathArgument)
  .option('-T, --template <template>', 'Template to use as a base for the environment')
  .option('-t, --title <title>', 'Title to use for the environment')
  .option(
    '-n, --no-config',
    "Don't create config for the environment in the local filesystem",
  )
  .action(async (envPath, cmdObj) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(envPath)
      const configPath = getConfigPath(root)

      let template = cmdObj.template as string | undefined
      let title = cmdObj.title as string | undefined

      if (!cmdObj.noConfig) {
        if (fs.existsSync(configPath)) {
          throw new Error(
            `Devbook config on path "${configPath}" already exists - cannot create a new config`,
          )
        }
      }

      const inquirer = await import('inquirer')

      if (!template) {
        const envsAnwsers = await inquirer.default.prompt([
          {
            name: 'template',
            message: chalk.default.underline('Select a template to use'),
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
            message: chalk.default.underline('Choose a title for the environment'),
            type: 'input',
            default: path.basename(root),
          },
        ])
        title = envsAnwsers['title'] as string | undefined
      }

      if (cmdObj.noConfig) {
        spinner.text = `Initializing a new environment with "${template}"`
      } else {
        spinner.text = `Initializing a new environment with "${template}" template in the "${root}" directory`
      }

      spinner.start()
      const config = await initEnvironment({
        template,
        title,
        apiKey,
        root,
        shouldSaveConfig: !cmdObj.noConfig,
      })
      spinner.stop()
      console.log(
        `Done - initialized a new environment "${formatEnvironment(
          config,
          cmdObj.noConfig ? undefined : root,
        )}"`,
      )
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

export async function initEnvironment({
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
    throw new Error(`Failed to initialize new environment for the template "${template}"`)
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
