import * as commander from 'commander'
import * as fs from 'fs/promises'
import * as path from 'path'

import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asFormattedError, asLocalRelative } from 'src/utils/format'

const basicDockerfile = `# You can use most Debian-based base images
FROM ubuntu: 20.04

# Install dependencies and customize environment
`

const dockerFileName = 'Dockerfile'

export const initCommand = new commander.Command('init')
  .description(
    'Create a basic E2B `Dockerfile` in the current directory. You can then run `e2b env build` to build an environment from this Dockerfile.',
  )
  .addOption(pathOption)
  .alias('it')
  .action(async (opts: { path?: string }) => {
    try {
      process.stdout.write('\n')

      const root = getRoot(opts.path)

      fs.writeFile(path.join(root, dockerFileName), basicDockerfile)

      const relativePath = opts.path
        ? path.join(opts.path, dockerFileName)
        : dockerFileName

      console.log(`Created ${asLocalRelative(relativePath)}`)

      process.stdout.write('\n')
    } catch (err: unknown) {
      console.error(asFormattedError((err as Error).message))
      process.exit(1)
    }
  })
