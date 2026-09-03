import { InvalidArgumentError } from '../../errors'

/**
 * Scope for command termination.
 *
 * `process` signals only the managed command process. `group` also signals
 * descendants that remain in the command's process group.
 */
export type CommandKillScope = 'process' | 'group'

export function validateCommandKillScope(
  scope: unknown
): asserts scope is CommandKillScope | undefined {
  if (scope !== undefined && scope !== 'process' && scope !== 'group') {
    throw new InvalidArgumentError(
      'Command kill scope must be one of: process, group.'
    )
  }
}
