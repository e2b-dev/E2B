import * as commander from 'commander'

import { asBold, asLocal } from './utils/format'

/**
 * Parse a CLI option as a positive integer, rejecting non-numeric values so
 * they don't silently become NaN.
 */
export function parsePositiveInt(label: string): (value: string) => number {
  return (value) => {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new commander.InvalidArgumentError(
        `${label} must be a positive integer. You provided ${asLocal(value)}.`
      )
    }
    return parsed
  }
}

/**
 * Parse a CLI option as a non-negative integer.
 */
export function parseNonNegativeInt(label: string): (value: string) => number {
  return (value) => {
    if (value.trim() === '') {
      throw new commander.InvalidArgumentError(
        `${label} must be a non-negative integer. You provided ${asLocal(value)}.`
      )
    }

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new commander.InvalidArgumentError(
        `${label} must be a non-negative integer. You provided ${asLocal(value)}.`
      )
    }
    return parsed
  }
}

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `change root directory where command is executed to ${asBold(
    '<path>'
  )} directory`
)

// Accepted but ignored by commands that used to read e2b.toml, so existing
// scripts keep working instead of failing with an opaque unknown option error.
export const deprecatedConfigOption = new commander.Option(
  '--config <e2b-toml>',
  `[deprecated] ${asBold('e2b.toml')} is no longer read`
).hideHelp()

/**
 * Warn when the ignored --config flag is passed, followed by a hint on what
 * to use instead.
 */
export function warnIgnoredConfigOption(
  opts: { config?: string },
  hint: string
) {
  if (!opts.config) return

  console.error(
    `The ${asBold('--config')} flag is deprecated and ignored, ${asLocal(
      'e2b.toml'
    )} is no longer read. ${hint}`
  )
}

export const projectOption = new commander.Option(
  '-t, --project <project-id>',
  'specify the project ID that the operation will be associated with. You can find project ID in the project settings in the E2B dashboard (https://e2b.dev/dashboard?tab=general).'
)

export const deprecatedTeamOption = new commander.Option(
  '--team <project-id>',
  `[deprecated] use ${asBold('--project')} instead`
).hideHelp()

/**
 * Read the project ID from parsed command options, preferring --project and
 * warning whenever the deprecated --team flag is used.
 */
export function projectIdFromOptions(opts: {
  project?: string
  team?: string
}): string | undefined {
  if (opts.team) {
    console.error(
      `The ${asBold('--team')} flag is deprecated, use ${asBold(
        '--project'
      )} instead.`
    )
  }
  return opts.project ?? opts.team
}

export const minFreeDiskMbOption = new commander.Option(
  '--min-free-disk-mb <min-free-disk-mb>',
  'requested minimum free space after build steps, in MiB. Omit for the team default or use 0 for no minimum growth. Growth is best effort and never shrinks the filesystem.'
).argParser(parseNonNegativeInt('Minimum free disk in MiB'))
