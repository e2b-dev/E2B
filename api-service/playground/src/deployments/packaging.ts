import {
  OutStderrResponse,
  OutStdoutResponse,
  ProcessManager,
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
 * 
 */
export async function packageFunction(session: Session, code: string) {
  const stderr: OutStderrResponse[] = []

  await session.filesystem?.write(rootfilePath, code)
  const bundling = await createSessionProcess({
    manager: session.process,
    cmd: `zip-it-and-ship-it ${functionsDir} ${bundleDir}`,
    rootdir,
    onStderr: o => stderr.push(o),
  })
  await bundling.exited

  if (stderr.length > 0) {
    console.error(stderr.map(o => o.line).join('\n'))
  }

  const zip = await readFileAsBase64(session, bundlePath)
  return Buffer.from(zip, 'base64')
}

/**
 * TODO: Implement binary file reading in devbookd so we don't have to send data via base64 (cca 25% overhead) and process stdout.
 */
async function readFileAsBase64(session: Session, filepath: string) {
  if (!session.filesystem || !session.process) {
    throw new Error('Session is not active')
  }

  const stderr: OutStderrResponse[] = []
  const dumpToBase64 = await createSessionProcess({
    manager: session.process,
    onStderr: o => stderr.push(o),
    cmd: `base64 -w 0 ${filepath} > ${dumpPath}`,
  })

  await dumpToBase64.exited

  if (stderr.length > 0) {
    throw new Error(`Error reading file ${stderr.map(o => o.line).join('\n')}`)
  }

  return await session.filesystem.read(dumpPath)
}
