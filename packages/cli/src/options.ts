import * as commander from 'commander'

import { asBold } from './utils/format'

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `change root directory where command is executed to ${asBold(
    '<path>',
  )} directory`,
)

export const selectOption = new commander.Option(
  '-s, --select',
  'select multiple sandbox templates from interactive list',
)

export const selectMultipleOption = new commander.Option(
  '-s, --select',
  'select sandbox template from interactive list',
)
