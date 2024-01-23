import * as yup from 'yup'
import * as toml from '@iarna/toml'
import * as fsPromise from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'

import { asFormattedSandboxTemplate, asLocalRelative } from 'src/utils/format'

export const maxContentSize = 256 * 1024 * 1024 // 256Mi
export const configName = 'e2b.toml'

function getConfigHeader(config: E2BConfig) {
  return `# This is a config for E2B sandbox template.
# You can use 'template_id' (${config.template_id}) ${config.template_name ? `or 'template_name (${config.template_name}) ` : ''}from this config to spawn a sandbox:

# Python SDK
# from e2b import Sandbox
# sandbox = Sandbox(template='${config.template_name || config.template_id}')

# JS SDK
# import { Sandbox } from 'e2b'
# const sandbox = await Sandbox.create({ template: '${config.template_name || config.template_id}' })

`
}

export const configSchema = yup.object({
  template_id: yup.string().required(),
  template_name: yup.string().optional(),
  dockerfile: yup.string().required(),
  start_cmd: yup.string().optional(),
})

export type E2BConfig = yup.InferType<typeof configSchema>;

interface Migration {
  from: string;
  to: string;
}

// List of name migrations from old config format to new one.
// We need to keep this list to be able to migrate old configs to new format.
const migrations: Migration[] = [
  {
    from: 'id',
    to: 'template_id',
  },
  {
    from: 'name',
    to: 'template_name',
  },
]

function applyMigrations(config: toml.JsonMap, migrations: Migration[]) {
  for (const migration of migrations) {
    const from = migration.from
    const to = migration.to

    if (config[from]) {
      config[to] = config[from]
      delete config[from]
    }
  }

  return config
}

export async function loadConfig(configPath: string) {
  const tomlRaw = await fsPromise.readFile(configPath, 'utf-8')
  const config = toml.parse(tomlRaw)
  const migratedConfig = applyMigrations(config, migrations)

  return (await configSchema.validate(migratedConfig)) as E2BConfig
}

export async function saveConfig(
  configPath: string,
  config: E2BConfig,
  overwrite?: boolean,
) {
  try {
    if (!overwrite) {
      const configExists = fs.existsSync(configPath)
      if (configExists) {
        throw new Error(
          `Config already exists on path ${asLocalRelative(configPath)}`,
        )
      }
    }

    const validatedConfig: any = await configSchema.validate(config, {
      stripUnknown: true,
    })

    const tomlRaw = toml.stringify(validatedConfig)
    await fsPromise.writeFile(configPath, getConfigHeader(config) + tomlRaw)
  } catch (err: any) {
    throw new Error(
      `E2B sandbox template config ${asFormattedSandboxTemplate(
        {
          envID: config.template_id,
        },
        configPath,
      )} cannot be saved: ${err.message}`,
    )
  }
}

export async function deleteConfig(configPath: string) {
  await fsPromise.unlink(configPath)
}

export function getConfigPath(root: string) {
  return path.join(root, configName)
}
