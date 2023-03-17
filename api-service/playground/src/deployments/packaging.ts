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


export async function packageFunction(session: Session, code: string) {
  const stderr: OutStderrResponse[] = []

  await session.filesystem?.write(rootfilePath, code)
  const bundling = await createSessionProcess({
    manager: session.process,
    cmd: `zip-it-and-ship-it ${functionsDir} ${bundleDir}`,
    rootdir,
    onStderr: stderr.push,
  })
  await bundling.exited

  if (stderr.length > 0) {
    console.error(stderr)
  }

  const zip = await readFileAsBase64(session.process!, bundlePath)
  return Buffer.from(zip, 'base64')
}

/**
 * TODO: Implement binary file reading in devbookd so we don't have to send data via base64 (cca 25% overhead) and process stdout.
 */
async function readFileAsBase64(manager: ProcessManager, filepath: string) {
  const stderr: OutStderrResponse[] = []
  const stdout: OutStdoutResponse[] = []

  const process = await createSessionProcess({
    manager,
    onStderr: stderr.push,
    onStdout: stdout.push,
    cmd: `base64 -w 0 ${filepath}`,
  })

  await process.exited

  if (stderr.length > 0) {
    throw new Error(`Error reading file ${stderr.map(o => o.line).join('\n')}`)
  }

  return stdout.map(o => o.line).join('\n')
}
