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

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `change root directory where command is executed to ${asBold(
    '<path>'
  )} directory`
)

// Only `template migrate` reads e2b.toml; no other command accepts this option.
export const configOption = new commander.Option(
  '--config <e2b-toml>',
  `specify path to the E2B config toml. By default E2B tries to find ${asBold(
    './e2b.toml'
  )} in root directory. We recommend using the new build system (https://e2b.dev/docs/template/defining-template) that does not use config files.`
)

// Accepted but ignored by commands that used to read e2b.toml, so existing
// scripts keep working instead of failing with an opaque unknown option error.
export const deprecatedConfigOption = new commander.Option(
  '--config <e2b-toml>',
  `[deprecated] ${asBold('e2b.toml')} is no longer read here`
).hideHelp()

/**
 * Warn when the ignored --config flag is passed to a command that no longer
 * reads e2b.toml.
 */
export function warnIgnoredConfigOption(opts: { config?: string }) {
  if (!opts.config) return

  console.error(
    `The ${asBold('--config')} flag is no longer read here. Pass the template as ${asBold(
      '[template]'
    )} or select it with ${asBold('-s')}. ${asBold(
      'e2b template migrate --config'
    )} still reads ${asLocal('e2b.toml')}.`
  )
}

export const selectMultipleOption = new commander.Option(
  '-s, --select',
  'select sandbox template from interactive list'
)

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
