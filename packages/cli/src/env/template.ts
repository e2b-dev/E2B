import { components } from '@devbookhq/sdk'

export type Template = components['schemas']['Template']

export const templates: { [keyof in Template]: boolean } = {
  Bash: true,
  Go: true,
  Nodejs: true,
  Python3: true,
  Rust: true,
  Typescript: true,
}

export function getTemplate(maybeTemplate: string) {
  const isTemplate = templates[maybeTemplate as Template]
  if (isTemplate) {
    return maybeTemplate as Template
  }
}
