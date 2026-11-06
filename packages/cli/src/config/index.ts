import * as toml from '@iarna/toml'
import { z } from 'zod'
import * as fsPromise from 'fs/promises'
import * as path from 'path'

const configName = 'e2b.toml'

export const configSchema = z.object({
  template_id: z.string(),
  template_name: z.string().optional(),
  dockerfile: z.string(),
  start_cmd: z.string().optional(),
  ready_cmd: z.string().optional(),
  cpu_count: z.number().int().min(1).optional(),
  memory_mb: z.number().int().min(128).optional(),
})

export type E2BConfig = z.infer<typeof configSchema>

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

  const result = configSchema.safeParse(migratedConfig)
  if (!result.success) {
    throw new Error(
      `Invalid config ${configPath}:\n${z.prettifyError(result.error)}`
    )
  }
  return result.data
}

export function getConfigPath(root: string, configPath?: string) {
  if (configPath && path.isAbsolute(configPath)) return configPath

  return path.join(root, configPath || configName)
}
