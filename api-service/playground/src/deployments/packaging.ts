import {
  FilesystemManager,
  OutStderrResponse,
  Session,
  createSessionProcess
} from '@devbookhq/sdk'
import path from 'path'


const rootdir = '/code'
const bundleDir = '/bundles'

const mjsRootPath = path.join(rootdir, 'index.mjs')
const jsRootPath = path.join(rootdir, 'index.js')
const bundlePath = path.join(bundleDir, 'index.zip')
const dumpPath = path.join(bundleDir, 'base')

const possibleRootfiles = [
  jsRootPath,
  mjsRootPath,
]

async function getRootFile(filesystem: FilesystemManager) {
  const rootResults = await Promise.allSettled(possibleRootfiles.map(async r => ({
    path: r,
    content: await filesystem.read(r),
  })))

  for (const root of rootResults) {
    if (root.status === 'fulfilled') {
      return root.value
    }
  }
}

function addAWSLambdaHandlers(code: string) {
  const isECMA = !code.includes('require')

  if (isECMA) {
    code = 'import serverless from "serverless-http;"\n' + code
    code = code + "\nexport const handler = serverless(app);"
  } else {
    code = "const serverless = require('serverless-http');\n" + code
    code = code + "\nexports.handler = serverless(app);"
  }

  return code.replace("app.listen(", "; ({})?.listen?.(")
}


/**
 * 
 * TODO: Configure esbuild to use Nodejs 18 and to minify the output.
 * TODO: Explore .js/.mjs bundling differences.
 * TODO: Implement binary file reading in devbookd so we don't have to send data via base64 (cca 25% overhead) and process stdout.
 * 
 */
export async function packageFunction(session: Session) {
  if (!session.filesystem || !session.process) {
    throw new Error('Session is not active')
  }
  const stderr: OutStderrResponse[] = []

  const rootFile = await getRootFile(session.filesystem)
  if (!rootFile) {
    throw new Error(`Cannot find rootfile matching ${possibleRootfiles.join(', ')}`)
  }

  const rootFileWithLambdaHandlers = addAWSLambdaHandlers(rootFile.content)

  await session.filesystem.write(rootFile.path, rootFileWithLambdaHandlers)
  // Bundle the code and dependencies via https://github.com/netlify/zip-it-and-ship-it and dump the base64 string representationto a separate file.
  const bundling = await createSessionProcess({
    manager: session.process,
    cmd: `zip-it-and-ship-it ${rootdir} ${bundleDir} && base64 -w 0 ${bundlePath} > ${dumpPath}`,
    rootdir,
    onStderr: o => stderr.push(o),
  })
  await bundling.exited

  if (stderr.length > 0) {
    console.error(stderr.map(o => o.line).join('\n'))
  }

  // Read the base64 representation as string. Because our filesystem.read reads file as UTF-8, we cannot read binary files this way without corrupting them.
  const zip = await session.filesystem.read(dumpPath)
  return Buffer.from(zip, 'base64')
}
