import fs from 'fs'
import path from 'path'

export function getAllPageFilePaths(directory: string): string[] {
  const fileNames = fs.readdirSync(directory)
  const filePaths = fileNames
    .map((fileName) => {
      const filePath = path.join(directory, fileName)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        return getAllPageFilePaths(filePath)
      } else if (path.basename(filePath) === 'page.mdx' || path.basename(filePath) === 'page.tsx') {
        return filePath
      }
    })
    .filter(Boolean)

  return Array.prototype.concat(...filePaths)
}
