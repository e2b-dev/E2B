import * as path from 'path'

export function getRoot(templatePath?: string) {
  const defaultPath = process.cwd()
  if (!templatePath) return defaultPath
  if (path.isAbsolute(templatePath)) return templatePath
  return path.resolve(defaultPath, templatePath)
}

export function cwdRelative(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath)
}
