import * as fs from 'fs'
import * as path from 'path'

/**
 * Generate unique file names to avoid overwriting existing files
 */
export function getUniqueFileName(
  directory: string,
  baseName: string,
  extension: string
): string {
  let fileName = `${baseName}${extension}`
  let counter = 1

  while (fs.existsSync(path.join(directory, fileName))) {
    fileName = `${baseName}-${counter}${extension}`
    counter++
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
