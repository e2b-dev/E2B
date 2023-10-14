import * as commander from 'commander'

import { asBold } from './utils/format'

export const reqIDArgument = new commander.Argument(
  '<id>',
  `Use environment specified by ${asBold('<id>')}`,
)
