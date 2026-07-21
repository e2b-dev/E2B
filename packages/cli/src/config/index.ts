import * as yup from 'yup'
import * as toml from '@iarna/toml'
import * as fsPromise from 'fs/promises'
import * as path from 'path'

export const configName = 'e2b.toml'

export const configSchema = yup.object({
  template_id: yup.string().required(),
  template_name: yup.string().optional(),
  dockerfile: yup.string().required(),
  start_cmd: yup.string().optional(),
  ready_cmd: yup.string().optional(),
  cpu_count: yup.number().integer().min(1).optional(),
  memory_mb: yup.number().integer().min(128).optional(),
  team_id: yup.string().optional(),
})

export type E2BConfig = yup.InferType<typeof configSchema>

interface Migration {
  from: string
  to: string
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

export async function deleteConfig(configPath: string) {
  await fsPromise.unlink(configPath)
}

export function getConfigPath(root: string, configPath?: string) {
  if (configPath && path.isAbsolute(configPath)) return configPath

  return path.join(root, configPath || configName)
}
