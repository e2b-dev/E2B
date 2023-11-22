import * as commander from 'commander'
import * as chalk from 'chalk'
import * as e2b from '@e2b/sdk'
import * as fs from 'fs'

import { ensureAccessToken } from 'src/api'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import { pathOption, selectMultipleOption } from 'src/options'
import { E2BConfig, configName, deleteConfig, getConfigPath, loadConfig } from 'src/config'
import { getRoot } from 'src/utils/filesystem'
import { listSandboxTemplates } from './list'
import { getPromptEnvs } from 'src/utils/templatePrompt'
import { confirm } from 'src/utils/confirm'

const deleteEnv = e2b.withAccessToken(
  e2b.api.path('/envs/{envID}').method('delete').create()
)

export const deleteCommand = new commander.Command('delete')
  .description(`Delete sanbdox template and ${asLocal(configName)} config`)
  .argument(
    '[template]',
    `Specify ${asBold(
      '[template]',
    )} to delete it. If you don's specify ${asBold(
      '[template]',
    )} the command will try delete sandbox template defined by ${asLocal('e2b.toml')}.`,
  )
  .addOption(pathOption)
  .addOption(selectMultipleOption)
  .alias('dl')
  .option('-y, --yes', 'Skip manual delete confirmation')
  .action(async (template, opts: { path?: string, yes?: boolean, select?: boolean }) => {
    try {
      const accessToken = ensureAccessToken()

      const root = getRoot(opts.path)

      const envs: (Pick<E2BConfig, 'template'> & { configPath?: string })[] = []

      if (template) {
        envs.push({
          template,
        })
      } else if (opts.select) {
        const allEnvs = await listSandboxTemplates({ accessToken })
        const selectedEnvs = await getPromptEnvs(allEnvs, 'Select sandbox templates to delete')
        envs.push(...selectedEnvs.map(e => ({ template: e.envID, ...e })))

        if (!envs || envs.length === 0) {
          console.log('No sandbox templates selected')
          return
        }
      } else {
        const configPath = getConfigPath(root)
        const config = fs.existsSync(configPath)
          ? await loadConfig(configPath)
          : undefined

        if (!config) {
          console.log(`No ${asLocal(configName)} found in ${asLocalRelative(root)}. Specify sandbox template with ${asBold('[template]')} argument or use interactive mode with ${asBold('-s')} flag.`)
          return
        }

        envs.push({
          ...config,
          configPath,
        })
      }

      if (!envs || envs.length === 0) {
        console.log(`No sandbox templates selected. Specify sandbox template with ${asBold('[template]')} argument or use interactive mode with  ${asBold('-s')} flag.`)
        return
      }

      console.log(chalk.default.red(chalk.default.underline('\nSandbox templates to delete')))
      envs.forEach(e => console.log(asFormattedSandboxTemplate({ ...e, envID: e.template }, e.configPath)))
      process.stdout.write('\n')

      if (!opts.yes) {
        const confirmed = await confirm(
          `Do you really want to delete ${envs.length === 1 ? 'this template' : 'these templates'
          }?`,
        )

        if (!confirmed) {
          console.log('Canceled')
          return
        }
      }

      await Promise.all(
        envs.map(async e => {
          console.log(`- Deleting sandbox template ${asFormattedSandboxTemplate({ ...e, envID: e.template }, e.configPath)}`)
          await deleteEnv(accessToken, { envID: e.template })
          if (e.configPath) {
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
