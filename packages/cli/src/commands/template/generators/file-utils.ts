import * as fs from 'fs'
import * as path from 'path'

/**
 * Write content to a file, creating directories if needed
 */
export async function writeFileContent(
  filePath: string,
  content: string
): Promise<void> {
  if (fs.existsSync(filePath)) {
    throw new Error(
      `File ${filePath} already exists. Aborting to avoid overwrite.`
    )
  }

  // Ensure directory exists
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
  }

  await fs.promises.writeFile(filePath, content)
}
