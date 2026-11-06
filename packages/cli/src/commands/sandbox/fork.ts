import * as commander from '@commander-js/extra-typings'
import * as e2b from 'e2b'
import { NotFoundError } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import { integer, zodParser } from 'src/validation'
import { parseTimeout } from './create'

const MAX_COUNT = 20

export const forkCommand = new commander.Command('fork')
  .description(
    'fork running sandbox into new sandboxes and print their IDs, one per line'
  )
  .argument(
    '<sandboxID>',
    `fork the sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('fk')
  .option(
    '-n, --count <count>',
    `number of forks to create, at most ${MAX_COUNT} (default: 1)`,
    zodParser(integer('--count', { min: 1, max: MAX_COUNT }))
  )
  .option(
    '--timeout <seconds>',
    'timeout of the forked sandboxes in seconds',
    parseTimeout
  )
  .action(async (sandboxID, opts) => {
    try {
      const apiKey = ensureAPIKey()

      const forks = await e2b.Sandbox.fork(sandboxID, {
        apiKey,
        ...(opts.count !== undefined ? { count: opts.count } : {}),
        ...(opts.timeout !== undefined ? { timeoutMs: opts.timeout } : {}),
      })

      let failed = 0
      forks.forEach((fork, index) => {
        if (fork instanceof Error) {
          failed += 1
          console.error(
            `Fork ${asBold(String(index + 1))} of ${asBold(
              sandboxID
            )} failed: ${fork.message}`
          )
        } else {
          console.log(fork.sandboxId)
        }
      })

      process.exit(failed > 0 ? 1 : 0)
    } catch (err: unknown) {
      if (err instanceof NotFoundError) {
        console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
      } else {
        console.error(err)
      }
      process.exit(1)
    }
  })
