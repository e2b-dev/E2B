import { createConfig, DevbookConfig } from '../config'

export async function useEnvironment({
  id,
  envRootPath,
}: {
  id: string
  apiKey: string
  envRootPath: string
}): Promise<DevbookConfig> {
  const config = await createConfig(envRootPath, id)
  return config
}
