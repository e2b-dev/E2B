import { listSandboxes } from './list'
import { wait } from '../../utils/wait'
import {asBold} from '../../utils/format'


export function formatEnum(e: { [key: string]: string }) {
  return Object.values(e)
    .map((level) => asBold(level))
    .join(', ')
}

export enum Format {
  JSON = 'json',
  PRETTY = 'pretty',
}


const maxRuntime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export function waitForSandboxEnd(sandboxID: string) {
  let isRunning = true

  async function monitor() {
    const startTime = new Date().getTime()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentTime = new Date().getTime()
      const elapsedTime = currentTime - startTime // Time elapsed in milliseconds

      // Check if 24 hours (in milliseconds) have passed
      if (elapsedTime >= maxRuntime) {
        break
      }

      const response = await listSandboxes()
      const sandbox = response.find(
        (s) => s.sandboxID === getShortID(sandboxID)
      )
      if (!sandbox) {
        isRunning = false
        break
      }
      await wait(5000)
    }
  }

  monitor()

  return () => isRunning
}

export function getShortID(sandboxID: string) {
  return sandboxID.split('-')[0]
}
