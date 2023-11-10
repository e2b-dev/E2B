import * as commander from 'commander'
import * as fsPromises from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'

import { basicDockerfile, defaultDockerfileName } from 'src/docker/constants'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asLocalRelative, asPrimary } from 'src/utils/format'

export const initCommand = new commander.Command('init')
  .description(
    `Create basic E2B Dockerfile (${asLocalRelative('e2b.Dockerfile')}) in root directory. You can then run ${asPrimary('e2b build')} to build sandbox template from this Dockerfile`,
  )
  .addOption(pathOption)
  .alias('it')
  .action(async (opts: { path?: string }) => {
    try {
      process.stdout.write('\n')

      const root = getRoot(opts.path)
      const filepath = path.join(root, defaultDockerfileName)

      const fileExists = fs.existsSync(filepath)

      const relativePath = opts.path
        ? path.join(opts.path, defaultDockerfileName)
        : defaultDockerfileName

      if (fileExists) {
        console.log(
          `Dockerfile ${asLocalRelative(relativePath)} already exists.\n`,
        )
        return
      }

      await fsPromises.writeFile(filepath, basicDockerfile)

      console.log(`Created ${asLocalRelative(relativePath)}\n`)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
