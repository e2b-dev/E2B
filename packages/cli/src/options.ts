import * as commander from 'commander'

import { asBold } from './utils/format'

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `Change root directory where command is executed to ${asBold(
    '<path>',
  )} directory`,
)
