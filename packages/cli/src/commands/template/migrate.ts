import * as boxen from 'boxen'
import * as commander from 'commander'
import { asBold, asLocal, asPrimary } from '../../utils/format'

export const migrateCommand = new commander.Command('migrate')
  .description('Deprecated: use `e2b template init` instead.')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async () => {
    const deprecationMessage = `${asBold('DEPRECATION WARNING')}

${asBold('e2b template migrate')} has been removed and no longer reads
${asLocal('e2b.toml')} or ${asLocal('e2b.Dockerfile')}.

Define your template with the Template SDK, for example with
${asBold("Template().fromDockerfile('e2b.Dockerfile')")}.

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
