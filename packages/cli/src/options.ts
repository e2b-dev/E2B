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

export const configOption = new commander.Option(
  '--config <e2b-toml>',
  `specify path to the E2B config toml. By default E2B tries to find ${asBold(
    './e2b.toml'
  )} in root directory. We recommend using the new build system (https://e2b.dev/docs/template/defining-template) that does not use config files.`
)

export const selectMultipleOption = new commander.Option(
  '-s, --select',
  'select sandbox template from interactive list'
)

export const teamOption = new commander.Option(
  '-t, --team <team-id>',
  '[deprecated] specify the team ID that the operation will be associated with. This option will be removed in future releases; the operation is scoped to the currently active project.'
)

export function warnDeprecatedTeamOption(team?: string) {
  if (team) {
    console.warn(
      "Warning: The '--team' option is deprecated and will be removed in future releases. The operation is scoped to the currently active project."
    )
  }
}
