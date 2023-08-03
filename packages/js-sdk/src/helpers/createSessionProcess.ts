import { OutStderrResponse, OutStdoutResponse } from '../session/out'
import { ProcessManager } from '../session/process'
import { createDeferredPromise } from '../utils/promise'

export async function createSessionProcess({
  cmd,
  manager,
  onStderr,
  onStdout,
  processID,
  rootdir,
}: {
  cmd: string
  manager?: ProcessManager
  onStdout?: (o: OutStdoutResponse) => void
  onStderr?: (o: OutStderrResponse) => void
  processID?: string
  rootdir?: string
}) {
  if (!manager) {
    throw new Error('Cannot create process - process manager is not defined')
  }

  const { resolve, promise: exited } = createDeferredPromise()

  const onExit = () => {
    resolve()
  }

  const process = await manager.start({
    cmd,
    onStdout,
    onStderr,
    onExit,
    rootdir,
    processID,
  })

  return {
    exited,
    processID: process.processID,
    kill: process.kill,
    sendStdin: process.sendStdin,
  }
}
