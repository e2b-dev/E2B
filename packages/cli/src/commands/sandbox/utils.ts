import { Sandbox, SandboxState } from 'e2b'
import { z } from 'zod'

import { ensureAPIKey } from 'src/api'
import { keyValuePairs, zodParser } from 'src/validation'
import { wait } from '../../utils/wait'
import { asBold } from '../../utils/format'

export function formatEnum(e: { [key: string]: string }) {
  return Object.values(e)
    .map((level) => asBold(level))
    .join(', ')
}

const SANDBOX_STATES = [
  'running',
  'paused',
] as const satisfies readonly SandboxState[]

/**
 * Parse a comma-separated `--state` filter, eg. `running,paused`, rejecting
 * states the API doesn't know instead of forwarding them.
 */
export const parseSandboxStates = zodParser(
  z
    .string()
    .transform((value) => value.split(',').map((state) => state.trim()))
    .pipe(
      z.array(
        z.enum(SANDBOX_STATES, {
          error: (issue) =>
            `Invalid state ${JSON.stringify(issue.input)}, expected ${SANDBOX_STATES.join(' or ')}.`,
        })
      )
    )
)

/** `--metadata` filter, eg. `key1=value1,key2=value2`. */
export const parseMetadata = zodParser(keyValuePairs)

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
