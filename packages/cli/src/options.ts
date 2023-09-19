import { Option } from 'commander'

import { asBold } from './utils/format'

export const allOption = new Option(
  '-a, --all',
  'Call this command in all subdirectories',
)

export const selectOption = new Option(
  '-s, --select',
  'Select environment from interactive list',
)

export const selectMultipleOption = new Option(
  '-s, --select',
  'Select environments from interactive list',
)

export const pathOption = new Option(
  '-p, --path <path>',
  `Call this command in ${asBold('<path>')} directory`,
)
