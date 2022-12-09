import * as sdk from '@devbookhq/sdk'
import * as chalk from 'chalk'
import * as path from 'path'

export function formatEnvironment(
  env: sdk.components['schemas']['Environment'],
  localPath?: string,
) {
  return `${env.id} ${chalk.default.bold(env.title)} ${chalk.default.dim(env.template)}${
    localPath ? ` (./${path.relative(process.cwd(), localPath)})` : ''
  }`
}

export function formatError(text: string, err: any) {
  return chalk.default.red(`${text}: ${err}`)
}
