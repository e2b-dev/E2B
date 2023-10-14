import * as commander from 'commander'

import { asBold } from './utils/format'

export const pathOption = new commander.Option(
  '-p, --path <path>',
  `Call this command in ${asBold('<path>')} directory`,
)
