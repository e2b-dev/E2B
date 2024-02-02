import * as chalk from 'chalk'
import * as e2b from 'e2b'
import * as highlight from 'cli-highlight'
import * as boxen from 'boxen'

import { cwdRelative } from './filesystem'

export const primaryColor = '#FFB766'

export function asFormattedSandboxTemplate(
  template: Pick<e2b.components['schemas']['Template'], 'templateID' | 'aliases'>,
  configLocalPath?: string,
) {
  const aliases = listAliases(template.aliases)

  const name = aliases ? asBold(aliases) : ''
  const configPath = configLocalPath
    ? asDim(' <-> ') + asLocalRelative(configLocalPath)
    : ''

  const id = `${template.templateID} `

  return `${id}${name}${configPath}`.trim()
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
  return chalk.default.hex(primaryColor)(content)
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

export function asHeadline(content: string) {
  return chalk.default.underline(asPrimary(asBold(content)))
}

export function listAliases(aliases: string[] | undefined) {
  if (!aliases) return undefined
  return aliases.join(' | ')
}

export function asTypescript(code: string) {
  return highlight.default(code, { language: 'typescript', ignoreIllegals: true })
}

export function asPython(code: string) {
  return highlight.default(code, { language: 'python', ignoreIllegals: true })
}

export const borderStyle = {
  topLeft: '',
  topRight: '',
  bottomLeft: '',
  bottomRight: '',
  top: '',
  bottom: '',
  left: '',
  right: ''
} as const

const horizontalPadding = 2
const verticalPadding = 1

export function withDelimiter(content: string, title: string, isLast?: boolean) {
  return boxen.default(content, {
    borderStyle: {
      ...borderStyle,
      top: '─',
      bottom: isLast ? '─' : '',
    },
    titleAlignment: 'center',
    float: 'left',
    title: title ? asBold(title) : undefined,
    margin: {
      top: 0,
      bottom: 0,
      left: 1,
      right: 0,
    },
    fullscreen: w => [w, 0],
    padding: {
      bottom: isLast ? verticalPadding : 0,
      left: horizontalPadding,
      right: horizontalPadding,
      top: verticalPadding,
    },
  })
}
