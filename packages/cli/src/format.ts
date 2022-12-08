import { components } from '@devbookhq/sdk'
import chalk from 'chalk'

export function formatEnvironment(
  env: components['schemas']['Environment'],
  localPath?: string,
) {
  return `${chalk.bold(env.id)} ${env.title} ${chalk.dim('(' + env.template + ')')} ${
    localPath ? `[${localPath}]` : ''
  }`
}

export function formatError(text: string, err: any) {
  return chalk.red(`${text}: ${err}`)
}
