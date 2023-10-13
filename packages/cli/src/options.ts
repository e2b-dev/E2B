import * as commander from 'commander'

import { asBold } from './utils/format'

export const allOption = new commander.Option(
  '-a, --all',
  'Call this command in all subdirectories',
)

export const selectOption = new commander.Option(
  '-s, --select',
  'Select environment from interactive list',
)

export const selectMultipleOption = new commander.Option(
  '-s, --select',
  'Select environments from interactive list',
)

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `Call this command in ${asBold('<path>')} directory`,
)
