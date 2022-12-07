import { api } from '@devbookhq/sdk'

import { createConfig, DevbookConfig } from '../config'

const createEnv = api.path('/envs').method('post').create({ api_key: true })

export async function initEnvironment({
  template,
  apiKey,
  envRootPath,
}: {
  template: string
  envRootPath: string
  apiKey: string
}): Promise<DevbookConfig> {
  const result = await createEnv({
    template,
    api_key: apiKey,
  })

  if (result.data.state === 'Failed') {
    throw new Error(`Failed to initialize new environment for the template "${template}"`)
  }

  const config = await createConfig(envRootPath, result.data.id)
  return config
}
