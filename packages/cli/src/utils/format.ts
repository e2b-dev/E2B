import * as chalk from 'chalk'
import * as e2b from '@e2b/sdk'

import { cwdRelative } from './filesystem'

export function asFormattedSandboxTemplate(
  template: Pick<e2b.components['schemas']['Environment'], 'envID'>,
  configLocalPath?: string,
) {
  const id = asBold(template.envID)
  const configPath = configLocalPath
    ? asDim(' <-> ') + asLocalRelative(configLocalPath)
    : ''

  return `${id}${configPath}`
}

export function asFormattedError(text: string | undefined, err?: any) {
  return chalk.default.redBright(
    `${text ? `${text} \n` : ''}${err ? err.stack : ''}\n`,
  )
}

export function asDim(content?: string) {
  return chalk.default.dim(content)
}

export function asBold(content: string) {
  return chalk.default.bold(content)
}

export function asPrimary(content: string) {
  return chalk.default.hex('#FFB766')(content)
}

export function asSandboxTemplate(pathInTemplate?: string) {
  return chalk.default.green(pathInTemplate)
}

export function asLocal(pathInLocal?: string) {
  return chalk.default.blue(pathInLocal)
}

export function asLocalRelative(absolutePathInLocal?: string) {
  if (!absolutePathInLocal) return ''
  return asLocal('./' + cwdRelative(absolutePathInLocal))
}

export function asBuildLogs(content: string) {
  return chalk.default.blueBright(content)
}
