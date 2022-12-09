import * as sdk from '@devbookhq/sdk'
import * as commander from 'commander'
import * as fsPromise from 'fs/promises'
import * as path from 'path'

import { client, ensureAPIKey } from 'src/api'
import { envPathArgument } from 'src/arguments'
import {
  DevbookConfig,
  configName,
  saveConfig,
  loadConfigs,
  getConfigPath,
} from 'src/config'
import { confirm } from 'src/interactions/confirm'
import { allOption } from 'src/options'
import { getFiles, getRoot } from 'src/utils/filesystem'
import { formatEnvironment } from 'src/utils/format'
import { getFilesHash } from 'src/utils/hashing'

export const pushCommand = new commander.Command('push')
  .description(
    `Upload environment files and update environment setup based on the "${configName}" config`,
  )
  .addArgument(envPathArgument)
  .addOption(allOption)
  .option('-h, --hash', 'Push changes only if the change hash of the files is different')
  // .option('-d, --delete-files', 'Delete files in the directories in the environment if these files are not present in the local filesystem')
  .action(async (envPath, cmdObj) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(envPath)

      const configs = await loadConfigs(root, cmdObj.all)

      if (configs.length === 0) {
        console.log('No environments found')
        return
      }

      configs.forEach(e => `- Environment "${formatEnvironment(e)}" is ready to push`)

      const confirmed = await confirm(
        `Do you really want to push ${
          configs.length === 1 ? 'the environment' : 'environments'
        }?`,
        true,
      )

      if (!confirmed) {
        console.log('Canceled')
        return
      }

      await Promise.all(
        configs.map(async config => {
          console.log(
            `- Pushing environment "${formatEnvironment(config, config.configPath)}"...`,
          )
          await pushEnvironment({
            apiKey,
            root: path.dirname(config.configPath),
            config,
            hash: cmdObj.hash,
          })
        }),
      )

      console.log('Done')

      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

export async function pushEnvironment({
  apiKey,
  root,
  config,
  hash,
}: {
  apiKey: string
  root: string
  config: DevbookConfig
  hash?: boolean
}): Promise<DevbookConfig> {
  await updateEnvTitle({
    api_key: apiKey,
    codeSnippetID: config.id,
    title: config.title,
  })

  const envFilesDir = path.join(root, config.filesystem.local_root)
  const filePaths = await getFiles(envFilesDir)

  let newChangeHash: string | undefined

  if (filePaths.length > 0) {
    console.log(
      `Syncing ${filePaths.length} ${
        filePaths.length === 1 ? 'file' : 'files'
      } from the ./${path.relative(process.cwd(), envFilesDir)} directory...`,
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
        console.log(
          `${filePaths.length} files from the "${envFilesDir}" will be are already in sync...`,
        )
        return config
      }
    }

    const session = new sdk.Session({
      apiKey,
      editEnabled: true,
      id: config.id,
    })

    // TODO: Delete files that should not be in the final destination

    try {
      await session.open()
      await Promise.all(
        files.map(async f => {
          const content = await fsPromise.readFile(f.path, 'utf-8')
          console.log(
            `./${path.relative(process.cwd(), f.path)} (local) -> ${f.rootPath} (env)`,
          )
          await session.filesystem?.makeDir(path.dirname(f.rootPath))
          await session.filesystem?.write(f.rootPath, content)
        }),
      )
    } finally {
      // Don't call close - the edit session is shared so we don't want to close it.
      // await session.close()
    }
  }

  const newConfig = {
    ...config,
    filesystem: {
      ...config.filesystem,
      change_hash: config.filesystem.change_hash || newChangeHash,
    },
  }

  const configPath = getConfigPath(root)
  await saveConfig(configPath, newConfig, true)

  return newConfig
}

const updateEnvTitle = client
  .path('/envs/{codeSnippetID}/title')
  .method('put')
  .create({ api_key: true })
