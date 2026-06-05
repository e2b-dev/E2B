import * as boxen from 'boxen'
import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from 'src/docker/constants'
import { asBold, asLocalRelative, asPrimary } from '../../utils/format'

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

function loadFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  return fs.readFileSync(filePath, 'utf-8')
}

export function getDockerfile(root: string, file?: string) {
  if (file) {
    const dockerfilePath = path.join(root, file)
    const dockerfileContent = loadFile(dockerfilePath)
    const dockerfileRelativePath = path.relative(root, dockerfilePath)

    if (dockerfileContent === undefined) {
      throw new Error(
        `No ${asLocalRelative(
          dockerfileRelativePath
        )} found in the root directory.`
      )
    }

    return {
      dockerfilePath,
      dockerfileContent,
      dockerfileRelativePath,
    }
  }

  let dockerfilePath = path.join(root, defaultDockerfileName)
  let dockerfileContent = loadFile(dockerfilePath)
  const defaultDockerfileRelativePath = path.relative(root, dockerfilePath)
  let dockerfileRelativePath = defaultDockerfileRelativePath

  if (dockerfileContent !== undefined) {
    return {
      dockerfilePath,
      dockerfileContent,
      dockerfileRelativePath,
    }
  }

  dockerfilePath = path.join(root, fallbackDockerfileName)
  dockerfileContent = loadFile(dockerfilePath)
  const fallbackDockerfileRelativeName = path.relative(root, dockerfilePath)
  dockerfileRelativePath = fallbackDockerfileRelativeName

  if (dockerfileContent !== undefined) {
    return {
      dockerfilePath,
      dockerfileContent,
      dockerfileRelativePath,
    }
  }

  throw new Error(
    `No ${asLocalRelative(defaultDockerfileRelativePath)} or ${asLocalRelative(
      fallbackDockerfileRelativeName
    )} found in the root directory (${root}). You can specify a custom Dockerfile with ${asBold(
      '--dockerfile <file>'
    )} option.`
  )
}
