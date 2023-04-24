import { ModelTemplateArg } from 'state/model'

export function parseInput(argTemplate: ModelTemplateArg, value: string) {
  if (argTemplate.type === 'number') {
    try {
      const result = parseFloat(value)
      return isNaN(result) ? undefined : result
    } catch {
      return
    }
  }

  return value
}
