import { CommandHandle, CommandExitError } from '../src/index.js'
import { assert } from 'vitest'

export function catchCmdExitErrorInBackground(cmd: CommandHandle) {
  let disabled = false

  cmd.wait().catch((res: CommandExitError) => {
    if (!disabled) {
      assert.equal(
        res.exitCode,
        0,
        `command failed with exit code ${res.exitCode}: ${res.stderr}`
      )
    }
  })

  return () => {
    disabled = true
  }
}
