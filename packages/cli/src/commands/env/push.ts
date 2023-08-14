import * as sdk from '@devbookhq/sdk'
import * as chalk from 'chalk'
import * as commander from 'commander'
import { existsSync } from 'fs'
import * as fsPromise from 'fs/promises'
import * as path from 'path'

import { client, ensureAPIKey } from 'src/api'
import { DevbookConfig, configName, saveConfig, loadConfigs } from 'src/config'
import { allOption, pathOption } from 'src/options'
import { getFiles, getRoot } from 'src/utils/filesystem'
import {
  asDim,
  asFormattedEnvironment,
  asFormattedError,
  asEnv,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import { getFilesHash } from 'src/utils/hashing'

export const pushCommand = new commander.Command('push')
  .description(`Update files in environment according to ${asLocal(configName)} config`)
  .addOption(allOption)
  .addOption(pathOption)
  .option('-h, --hash', 'Update files only if their hash changed since last push')
  .alias('ps')
  .action(async opts => {
    try {
      const apiKey = ensureAPIKey()
      process.stdout.write('\n')

      const root = getRoot(opts.path)

      const configs = await loadConfigs(root, opts.all)

      if (configs.length === 0) {
        console.log(
          `No environments found in ${asLocalRelative(root)}${
            opts.all ? ' and its subdirectories' : ''
          }`,
        )
        return
      }

      await Promise.all(
        configs.map(async config => {
          console.log(
            `- Pushing environment ${asFormattedEnvironment(config, config.configPath)}`,
          )
          await pushEnvironment({
            apiKey,
            root: path.dirname(config.configPath),
            config,
            configPath: config.configPath,
            hash: opts.hash,
          })
        }),
      )
      process.stdout.write('\n')
      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function pushEnvironment({
  apiKey,
  root,
  config,
  hash,
  configPath,
}: {
  apiKey: string
  root: string
  configPath: string
  config: DevbookConfig
  hash?: boolean
}): Promise<DevbookConfig> {
  try {
    await updateEnvTitle({
      api_key: apiKey,
      codeSnippetID: config.id,
      title: config.title,
    })
  } catch (err: any) {
    throw new Error(
      `Error updating environment from config ${asLocalRelative(configPath)}: ${
        err.message
      }`,
    )
  }

  try {
    const envFilesDir = path.join(root, config.filesystem.local_root)

    if (!existsSync(envFilesDir)) {
      throw new Error(
        `Directory ${asLocalRelative(
          envFilesDir,
        )} defined in "filesystem.local_root" field in ${asLocalRelative(
          configPath,
        )} config does not exist`,
      )
    }

    const filePaths = await getFiles(envFilesDir)

    let newChangeHash: string | undefined

    if (filePaths.length > 0) {
      console.log(
        ' ',
        chalk.default.underline(
          `Syncing ${filePaths.length} ${
            filePaths.length === 1 ? 'file' : 'files'
          } from ${asLocalRelative(envFilesDir)} directory`,
        ),
      )

      const files = await Promise.all(
        filePaths.map(async f => {
          const content = await fsPromise.readFile(f.path, 'utf-8')
          return {
            ...f,
            content,
          }
        }),
      )

      if (hash) {
        newChangeHash = getFilesHash(files)

        if (config.filesystem.change_hash === newChangeHash) {
          console.log(`  Directory ${asLocalRelative(envFilesDir)} is already in sync`)
          return config
        }
      }

      const session = new sdk.Session({
        apiKey,
        editEnabled: true,
        id: config.id,
      })

      // TODO: Delete files that should not be in the final destination

      await session.open()
      await Promise.all(
        files.map(async f => {
          const content = await fsPromise.readFile(f.path, 'utf-8')
          console.log(
            `  - ${asLocalRelative(f.path)} ${asDim('(local)')} ${asDim('-->')} ${asEnv(
              f.rootPath,
            )} ${asDim('(env)')}`,
          )
          await session.filesystem?.makeDir(path.dirname(f.rootPath))
          await session.filesystem?.write(f.rootPath, content)
        }),
      )
    }

    const newConfig = {
      ...config,
      filesystem: {
        ...config.filesystem,
        change_hash: config.filesystem.change_hash || newChangeHash,
      },
    }

    await saveConfig(configPath, newConfig, true)

    return newConfig
  } catch (err: any) {
    throw new Error(
      `Error updating environment from config ${asLocalRelative(configPath)}: ${
        err.message
      }`,
    )
  }
}

const updateEnvTitle = client
  .path('/envs/{codeSnippetID}/title')
  .method('put')
  .create({ api_key: true })
