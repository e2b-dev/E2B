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
 * Choices for the interactive target language prompt.
 */
export const languageChoices = [
  {
    name: languageDisplay[Language.TypeScript],
    value: Language.TypeScript,
    description: 'Generate .ts files for JavaScript/TypeScript projects',
  },
  {
    name: languageDisplay[Language.PythonSync],
    value: Language.PythonSync,
    description: 'Generate synchronous Python template files',
  },
  {
    name: languageDisplay[Language.PythonAsync],
    value: Language.PythonAsync,
    description: 'Generate asynchronous Python template files',
  },
]

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
