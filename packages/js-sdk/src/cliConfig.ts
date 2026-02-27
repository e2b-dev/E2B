import { runtime } from './utils'

/**
 * User configuration stored by the E2B CLI in ~/.e2b/config.json
 */
export interface CLIConfig {
  email?: string
  accessToken?: string
  teamName?: string
  teamId?: string
  teamApiKey?: string
  dockerProxySet?: boolean
}

let cachedConfig: CLIConfig | null = null
let configLoaded = false

function getCLIConfigPath(): string | null {
  if (runtime !== 'node' && runtime !== 'bun') {
    return null
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('os')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')
    return path.join(os.homedir(), '.e2b', 'config.json')
  } catch {
    return null
  }
}

/**
 * Reads the CLI configuration from ~/.e2b/config.json if it exists.
 * This is used as a fallback when API key or access token is not provided
 * directly or via environment variables.
 *
 * @returns The CLI configuration or null if not available
 */
export function getCLIConfig(): CLIConfig | null {
  if (configLoaded) {
    return cachedConfig
  }

  configLoaded = true

  const configPath = getCLIConfigPath()
  if (!configPath) {
    return null
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    if (!fs.existsSync(configPath)) {
      return null
    }
    cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    return cachedConfig
  } catch {
    return null
  }
}

/**
 * Clears the cached CLI configuration.
 * This is primarily used for testing purposes.
 */
export function clearCLIConfigCache(): void {
  cachedConfig = null
  configLoaded = false
}
