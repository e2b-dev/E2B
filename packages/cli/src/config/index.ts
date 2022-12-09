import * as yup from 'yup'
import * as toml from '@iarna/toml'
import * as fsPromise from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dockerNames = require('docker-names')

import { getFiles } from '../utils/filesystem'
import { formatEnvironment } from 'src/utils/format'

export const configName = 'dbk.toml'

const configCommentHeader = `# This is a config for a Devbook environment

`

export const configSchema = yup.object({
  id: yup.string().required(),
  template: yup.string().required(),
  title: yup.string().default(() => dockerNames.getRandomName().replace('_', '-')),
  filesystem: yup.object({
    change_hash: yup.string(),
    local_root: yup
      .string()
      .required()
      .default(() => './files'),
  }),
})

export type DevbookConfig = yup.InferType<typeof configSchema>

export async function loadConfig(configPath: string) {
  const configExists = fs.existsSync(configPath)
  if (!configExists) {
    throw new Error(
      `Devbook environment config "${configName}" does not exist in this (${configPath}) directory - cannot read the config.`,
    )
  }

  const tomlRaw = await fsPromise.readFile(configPath, 'utf-8')
  const config = toml.parse(tomlRaw)
  return (await configSchema.validate(config)) as DevbookConfig
}

export async function saveConfig(
  configPath: string,
  config: DevbookConfig,
  overwrite?: boolean,
) {
  if (!overwrite) {
    const configExists = fs.existsSync(configPath)
    if (configExists) {
      throw new Error(
        `Devbook environment config "${configName}" already exists in this (${configPath}) directory - config for environemnt "${config.id}" cannot be created here.`,
      )
    }
  }

  const tomlRaw = toml.stringify(config as any)
  await fsPromise.writeFile(configPath, configCommentHeader + tomlRaw)
}

export async function deleteConfig(configPath: string) {
  await fsPromise.unlink(configPath)
}

export function getConfigPath(root: string) {
  return path.join(root, configName)
}

export async function getNestedConfigs(rootPath: string) {
  return getFiles(rootPath, { name: configName })
}

export async function loadConfigs(rootPath: string, nested?: boolean) {
  const configPaths = nested
    ? (await getNestedConfigs(rootPath)).map(c => c.path)
    : [getConfigPath(rootPath)]

  return Promise.all(
    configPaths.map(async configPath => {
      const config = await loadConfig(configPath)
      console.log(`- Found environment "${formatEnvironment(config, configPath)}"`)
      return {
        ...config,
        configPath,
      }
    }),
  )
}
