export enum Language {
  TypeScript = 'typescript',
  PythonSync = 'python-sync',
  PythonAsync = 'python-async',
}

export const validLanguages: Language[] = [
  Language.TypeScript,
  Language.PythonSync,
  Language.PythonAsync,
]

export const languageDisplay = {
  [Language.TypeScript]: 'TypeScript',
  [Language.PythonSync]: 'Python (sync)',
  [Language.PythonAsync]: 'Python (async)',
}

export interface TemplateJSON {
  fromImage?: string
  fromTemplate?: string
  startCmd?: string
  readyCmd?: string
  force: boolean
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
