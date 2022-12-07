import { Session } from '@devbookhq/sdk'
import { readFile } from 'fs/promises'
import path from 'path'
import { getFiles } from 'src/files'
import { DevbookConfig, loadConfig } from '../config'

export async function pushEnvironment({
  apiKey,
  envRootPath,
}: {
  apiKey: string
  envRootPath: string
}): Promise<DevbookConfig> {
  const config = await loadConfig(envRootPath)

  const envFilesDir = path.join(envRootPath, config.filesystem.local_root)
  const files = await getFiles(envFilesDir)

  console.log(`${files.length} files from the "${envFilesDir}" will be uploaded...`)

  const session = new Session({
    apiKey,
    editEnabled: true,
    id: config.id,
  })

  await session.open()

  await Promise.all(
    files.map(async f => {
      const content = await readFile(f.path, 'utf-8')
      await session.filesystem?.write(f.rootPath, content)
    }),
  )

  await session.close()

  return config
}
