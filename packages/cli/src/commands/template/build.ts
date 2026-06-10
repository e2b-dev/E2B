import * as boxen from 'boxen'
import * as commander from 'commander'
import { asBold, asPrimary } from '../../utils/format'

export const buildCommand = new commander.Command('build')
  .description('Deprecated: use `e2b template create` instead.')
  .argument('[template]', 'unused')
  .allowUnknownOption(true)
  .alias('bd')
  .action(async () => {
    const deprecationMessage = `${asBold('DEPRECATION WARNING')}

This is the v1 build system which is now deprecated.
Please migrate to the new build system v2.

Migration guide: ${asPrimary('https://e2b.dev/docs/template/migration-v2')}`

    const deprecationWarning = boxen.default(deprecationMessage, {
      padding: {
        bottom: 0,
        top: 0,
        left: 2,
        right: 2,
      },
      margin: {
        top: 1,
        bottom: 1,
        left: 0,
        right: 0,
      },
      borderColor: 'yellow',
      borderStyle: 'round',
    })

    console.log(deprecationWarning)
    process.exit(1)
  })
