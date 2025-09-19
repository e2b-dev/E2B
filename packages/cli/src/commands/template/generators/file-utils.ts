import * as fs from 'fs'
import * as path from 'path'

/**
 * Check if file exists to avoid overwriting existing files
 */
export function errorIfExists(
  directory: string,
  baseName: string,
  extension: string
): string {
  const fileName = `${baseName}${extension}`

  if (fs.existsSync(path.join(directory, fileName))) {
    throw new Error(
      `File ${fileName} already exists. Aborting to avoid overwrite.`
    )
  }

  return fileName
}

/**
 * Write content to a file, creating directories if needed
 */
export async function writeFileContent(
  filePath: string,
  content: string
): Promise<void> {
  const dir = path.dirname(filePath)

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
  }

  await fs.promises.writeFile(filePath, content)
}
