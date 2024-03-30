import * as commander from 'commander'

import { asBold } from './utils/format'

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `change root directory where command is executed to ${asBold(
    '<path>',
  )} directory`,
)

export const configOption = new commander.Option(
  '--config <e2b-toml>',
  'specify path to the e2b config toml. By default E2B tries to find e2b.toml in root directory.',
)

export const selectOption = new commander.Option(
  '-s, --select',
  'select multiple sandbox templates from interactive list',
)

export const selectMultipleOption = new commander.Option(
  '-s, --select',
  'select sandbox template from interactive list',
)
