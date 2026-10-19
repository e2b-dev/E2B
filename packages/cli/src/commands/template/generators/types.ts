import * as commander from 'commander'

export enum Language {
  TypeScript = 'typescript',
  PythonSync = 'python-sync',
  PythonAsync = 'python-async',
}

export const languageDisplay = {
  [Language.TypeScript]: 'TypeScript',
  [Language.PythonSync]: 'Python (sync)',
  [Language.PythonAsync]: 'Python (async)',
}

/**
 * Parses the `--language` option value, rejecting unknown languages.
 */
export function parseLanguage(value: string): Language {
  if (!Object.values(Language).includes(value as Language)) {
    throw new commander.InvalidArgumentError(
      `Invalid language. Must be one of: ${Object.values(Language).join(', ')}`
    )
  }
  return value as Language
}

export interface TemplateJSON {
  fromImage?: string
  fromTemplate?: string
  startCmd?: string
  readyCmd?: string
  force: boolean
}

export interface TemplateWithStepsJSON extends TemplateJSON {
  steps: Array<{
    type: string
    args: string[]
    filesHash?: string
    force?: boolean
  }>
}

export interface GeneratedFiles {
  templateFile: string
  buildDevFile: string
  buildProdFile: string
  language: Language
}
