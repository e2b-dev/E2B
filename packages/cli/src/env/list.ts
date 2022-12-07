import { api } from '@devbookhq/sdk'

const listEnvs = api.path('/envs').method('get').create()

export async function listEnvironments({ apiKey }: { apiKey: string }) {
  const result = await listEnvs({
    api_key: apiKey,
  })

  return result.data
}
