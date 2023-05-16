import { LanguageSetup, ServerCapabilities } from '@devbookhq/code-editor'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'

import typescriptDefaultServerCapabilities from './languageServerCapabilities/typescript.json'

export enum LanguageID {
  TypeScript = 'typescript',
  Json = 'json',
  Prisma = 'prisma',
  Python = 'python',
}

export const supportedLanguages: LanguageSetup[] = [
  {
    languageID: LanguageID.TypeScript,
    fileExtensions: ['.js', '.ts'],
    languageExtensions: javascript({ typescript: true }),
    defaultServerCapabilities: typescriptDefaultServerCapabilities.result.capabilities as ServerCapabilities,
    languageServerCommand: 'typescript-language-server',
  },
  {
    languageID: LanguageID.Json,
    fileExtensions: ['.json'],
    languageExtensions: json(),
  },
  {
    languageID: LanguageID.Python,
    fileExtensions: ['.py'],
    languageExtensions: python(),
  }
  // {
  //   // Necessary packages were installed by `npm i -g @prisma/language-server`
  //   languageServerCommand: 'prisma-language-server',
  //   fileExtensions: ['.prisma'],
  //   languageID: LanguageID.Prisma,
  //   defaultServerCapabilities: prismaDefaultServerCapabilities.result.capabilities as ServerCapabilities,
  // },
]