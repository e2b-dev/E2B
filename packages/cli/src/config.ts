import { object, string, InferType } from 'yup'
import toml from '@iarna/toml'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export const configName = 'dbk.toml'

const configSchema = object({
  id: string().required(),
  filesystem: object({
    local_root: string().required(),
  }).required(),
})

export type DevbookConfig = InferType<typeof configSchema>

const defaultConfig: Omit<DevbookConfig, 'id'> = {
  filesystem: {
    local_root: './files',
  },
}

export async function loadConfig(envRootPath: string) {
  const configPath = path.join(envRootPath, configName)

  const configExists = existsSync(configPath)
  if (!configExists) {
    throw new Error(
      `Devbook environment config "${configName}" does not exist in this (${envRootPath}) directory - cannot read the config.`,
    )
  }

  const tomlRaw = await readFile(configPath, 'utf-8')
  const config = toml.parse(tomlRaw)
  console.log(
    `Devbook config with environment ID "${config.id}" created at "${configPath}".`,
  )
  return (await configSchema.validate(config)) as DevbookConfig
}

export async function createConfig(envRootPath: string, id: string) {
  const configPath = path.join(envRootPath, configName)

  const configExists = existsSync(configPath)
  if (configExists) {
    throw new Error(
      `Devbook environment config "${configName}" already exists in this (${envRootPath}) directory - config for environemnt "${id}" cannot be created here.`,
    )
  }

  const config: DevbookConfig = {
    id,
    ...defaultConfig,
  }
  const tomlRaw = toml.stringify(config)
  await writeFile(configPath, tomlRaw)
  console.log(
    `Devbook config with environment ID "${config.id}" found at "${configPath}".`,
  )

  return config
}
