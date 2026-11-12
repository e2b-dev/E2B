import { z } from 'zod'

import { zodParser } from '../../../validation'

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

/** `--language` value. */
export const parseLanguage = zodParser(
  z.enum(Language, {
    error: `Invalid language. Must be one of: ${Object.values(Language).join(', ')}.`,
  })
)

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
