import {
  OutStderrResponse,
  Session,
  createSessionProcess
} from '@devbookhq/sdk'
import path from 'path'


const rootdir = '/code'

const functionsDir = 'funcs'
const bundleDir = 'bundles'

const rootfilePath = path.join(rootdir, functionsDir, 'index.mjs')
const bundlePath = path.join(rootdir, bundleDir, 'index.zip')
const dumpPath = path.join(rootdir, bundleDir, 'base')

/**
 * 
 * TODO: Configure esbuild to use Nodejs 18 and to minify the output.
 * TODO: Explore .js/.mjs bundling differences.
 * TODO: Implement binary file reading in devbookd so we don't have to send data via base64 (cca 25% overhead) and process stdout.
 * 
 */
export async function packageFunction(session: Session, code: string) {
  if (!session.filesystem || !session.process) {
    throw new Error('Session is not active')
  }
  const stderr: OutStderrResponse[] = []

  await session.filesystem?.write(rootfilePath, code)
  // Bundle the code and dependencies via https://github.com/netlify/zip-it-and-ship-it and dump the base64 string representationto a separate file.
  const bundling = await createSessionProcess({
    manager: session.process,
    cmd: `zip-it-and-ship-it ${functionsDir} ${bundleDir} && base64 -w 0 ${bundlePath} > ${dumpPath}`,
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
