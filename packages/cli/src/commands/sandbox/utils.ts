import * as commander from '@commander-js/extra-typings'
import { wait } from '../../utils/wait'
import { asBold, asLocal } from '../../utils/format'
import { Sandbox, SandboxState } from 'e2b'
import { ensureAPIKey } from 'src/api'

export function formatEnum(e: { [key: string]: string }) {
  return Object.values(e)
    .map((level) => asBold(level))
    .join(', ')
}

const SANDBOX_STATES: readonly SandboxState[] = ['running', 'paused']

/**
 * Parse a comma-separated `--state` filter, eg. `running,paused`, rejecting
 * states the API doesn't know instead of forwarding them.
 */
export function parseSandboxStates(value: string): SandboxState[] {
  return value.split(',').map((raw) => {
    const state = raw.trim() as SandboxState
    if (!SANDBOX_STATES.includes(state)) {
      throw new commander.InvalidArgumentError(
        `Invalid state ${asLocal(raw)}, expected ${SANDBOX_STATES.join(' or ')}.`
      )
    }
    return state
  })
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

  return () => running
}

export async function isRunning(sandboxID: string) {
  try {
    const apiKey = ensureAPIKey()
    const info = await Sandbox.getInfo(sandboxID, {
      apiKey,
    })
    return info.state === 'running'
  } catch (err) {
    console.error(`Failed to check sandbox status: ${err}`)
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
