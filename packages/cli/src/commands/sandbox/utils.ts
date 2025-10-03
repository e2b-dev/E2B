import { wait } from '../../utils/wait'
import { asBold } from '../../utils/format'
import { Sandbox } from 'e2b'
import { ensureAPIKey } from 'src/api'

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
  let running = true

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

      running = await isRunning(sandboxID)
      if (!running) {
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

export async function isRunning(sandboxID: string) {
  try {
    const apiKey = ensureAPIKey()
    const info = await Sandbox.getInfo(getShortID(sandboxID), {
      apiKey,
    })
    return info.state === 'running'
  } catch {
    return false
  }
}

export function parseMetadata(metadataRaw?: string) {
  let metadata: Record<string, string> | undefined = undefined
  if (metadataRaw && metadataRaw.length > 0) {
    const parsedMetadata: Record<string, string> = {}
    metadataRaw.split(',').map((pair: string) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        parsedMetadata[key.trim()] = value.trim()
      }
    })

    metadata = parsedMetadata
  }

  return metadata
}
