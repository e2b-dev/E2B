import { SANDBOX_INSPECT_URL } from 'src/user'
import { asPrimary } from './format'

/**
 * Prints a clickable URL to the E2B Dashboard for inspecting a sandbox
 *
 * This function creates a terminal-clickable link that allows users to
 * inspect their sandbox in the E2B Dashboard. The link is formatted with
 * ANSI escape sequences to make it clickable in compatible terminals.
 *
 * @param {string} sandboxId - The ID of the sandbox to inspect
 * @param {object} [opts] - Options
 * @param {'stdout' | 'stderr'} [opts.stream] - Stream to print to, defaults to stdout
 */
export const printDashboardSandboxInspectUrl = (
  sandboxId: string,
  opts?: { stream?: 'stdout' | 'stderr' }
) => {
  const url = SANDBOX_INSPECT_URL(sandboxId)
  const clickable = `\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007`
  const print = opts?.stream === 'stderr' ? console.error : console.log

  print('')
  print(
    'Use the following link to inspect this Sandbox live inside the E2B Dashboard️:'
  )
  print(asPrimary(`↪ ${clickable}`))
  print('')
}
