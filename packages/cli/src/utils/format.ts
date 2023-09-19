import * as sdk from '@devbookhq/sdk'
import * as chalk from 'chalk'

import { cwdRelative } from './filesystem'

export function asFormattedEnvironment(
  env: sdk.components['schemas']['Environment'],
  localPath?: string,
) {
  const id = asBold(env.id)
  const template = env.template ? asTemplate` [${env.template}]` : ''
  const title = env.title ? ` ${env.title}` : ''
  const configPath = localPath ? asDim(' <-> ') + asLocalRelative(localPath) : ''

  return `${id}${template}${title}${configPath}`
}

export function asFormattedError(text: string, err?: any) {
  return chalk.default.redBright(`> ${text} ${err ? ':\n' + err : ''}\n`)
}

export function asDim(content?: string) {
  return chalk.default.dim(content)
}

export function asBold(content: string) {
  return chalk.default.bold(content)
}

export function asEnv(pathInEnv?: string) {
  return chalk.default.green(pathInEnv)
}

export function asTemplate(t: TemplateStringsArray, template: string) {
  return chalk.default.dim(t[0] + template + t[1])
}

export function asLocal(pathInLocal?: string) {
  return chalk.default.blue(pathInLocal)
}

export function asLocalRelative(absolutePathInLocal?: string) {
  if (!absolutePathInLocal) return ''
  return asLocal('./' + cwdRelative(absolutePathInLocal))
}
