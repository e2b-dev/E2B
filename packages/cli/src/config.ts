import * as yup from 'yup'
import * as toml from '@iarna/toml'
import * as fsPromise from 'fs/promises'
import * as path from 'path'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dockerNames = require('docker-names')

import { getFiles } from './files'

export const configName = 'dbk.toml'

const configSchema = yup.object({
  id: yup.string().required(),
  title: yup.string().required(),
  template: yup.string().required(),
  filesystem: yup
    .object({
      local_root: yup.string().required(),
    })
    .required(),
})

export type DevbookConfig = yup.InferType<typeof configSchema>

function getDefaultConfig() {
  const defaultConfig: Omit<DevbookConfig, 'id' | 'template'> = {
    title: dockerNames.getRandomName().replace('_', '-'),
    filesystem: {
      local_root: './files',
    },
  }
  return defaultConfig
}

export async function loadConfig(envRootPath: string) {
  const configPath = path.join(envRootPath, configName)

  const configExists = fs.existsSync(configPath)
  if (!configExists) {
    throw new Error(
      `Devbook environment config "${configName}" does not exist in this (${envRootPath}) directory - cannot read the config.`,
    )
  }

  const tomlRaw = await fsPromise.readFile(configPath, 'utf-8')
  const config = toml.parse(tomlRaw)
  console.log(
    `Devbook config with environment ID "${config.id}" found at "${configPath}".`,
  )
  return (await configSchema.validate(config)) as DevbookConfig
}

export async function createConfig(envRootPath: string, id: string, template: string) {
  const configPath = path.join(envRootPath, configName)

  const configExists = fs.existsSync(configPath)
  if (configExists) {
    throw new Error(
      `Devbook environment config "${configName}" already exists in this (${envRootPath}) directory - config for environemnt "${id}" cannot be created here.`,
    )
  }

  const config: DevbookConfig = {
    id,
    template,
    ...getDefaultConfig(),
  }
  const tomlRaw = toml.stringify(config)
  await fsPromise.writeFile(configPath, tomlRaw)
  console.log(
    `Devbook config with environment ID "${config.id}" created at "${configPath}".`,
  )

  return config
}

export async function getNestedConfigs(rootPath: string) {
  return getFiles(rootPath, { name: configName })
}

export function getEnvRootPath(envPath?: string) {
  const defaultPath = process.cwd()

  if (!envPath) {
    return defaultPath
  }

  if (path.isAbsolute(envPath)) {
    return envPath
  }

  return path.resolve(defaultPath, envPath)
}
