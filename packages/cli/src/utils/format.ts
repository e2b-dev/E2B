import * as chalk from 'chalk'
import * as e2b from '@e2b/sdk'

import { cwdRelative } from './filesystem'

export function asFormattedEnvironment(
  env: Pick<e2b.components['schemas']['Environment'], 'envID'>,
) {
  const id = asBold(env.envID)

  return `${id}`
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

export function asLocal(pathInLocal?: string) {
  return chalk.default.blue(pathInLocal)
}

export function asLocalRelative(absolutePathInLocal?: string) {
  if (!absolutePathInLocal) return ''
  return asLocal('./' + cwdRelative(absolutePathInLocal))
}
