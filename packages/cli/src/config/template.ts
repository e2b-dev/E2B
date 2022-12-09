import * as sdk from '@devbookhq/sdk'

import { notEmpty } from '../utils/notEmpty'

export type Template = sdk.components['schemas']['Template'] | 'Prisma'

type Templates = { [key in Template]: boolean }

const enabledTemplates: Templates = {
  Bash: true,
  Go: true,
  Nodejs: true,
  Python3: true,
  Rust: true,
  Typescript: true,
  // Custom template
  Prisma: false,
}

export const templates = Object.entries(enabledTemplates)
  .map(([k, v]) => (v ? k : undefined))
  .filter(notEmpty)
