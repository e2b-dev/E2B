import { z } from 'zod'

import { zodParser } from '../validation'

const parseEnvPair = zodParser(
  z
    .string()
    .regex(/^[^=]+=/, {
      error: (issue) =>
        `Invalid environment variable ${JSON.stringify(issue.input)}, expected KEY=VALUE.`,
    })
    .transform((pair) => {
      const separator = pair.indexOf('=')
      return [pair.slice(0, separator), pair.slice(separator + 1)] as const
    })
)

/**
 * Commander arg parser for repeatable `--env KEY=VALUE` flags.
 *
 * Accumulates parsed pairs into `previous` so the flag can be passed multiple
 * times. Values may contain `=` (only the first `=` separates key from value).
 * Commander passes `undefined` on the first occurrence; starting from a fresh
 * object here instead of an option default keeps `(default: {})` out of help.
 */
export function parseEnv(
  value: string,
  previous: Record<string, string> = {}
): Record<string, string> {
  const [key, envValue] = parseEnvPair(value)
  previous[key] = envValue
  return previous
}
