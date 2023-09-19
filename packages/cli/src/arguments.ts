import * as commander from 'commander'

import { asBold } from './utils/format'

export const idArgument = new commander.Argument(
  '[id]',
  `Use environment specified by ${asBold('[id]')}`,
)

export const idsArgument = new commander.Argument(
  '[ids...]',
  `Use environments specified by ${asBold('[ids...]')}`,
)
