import { InvalidArgumentError } from '@commander-js/extra-typings'
import { z } from 'zod'

/**
 * Turn a zod schema into a commander argument parser.
 *
 * A failed parse throws InvalidArgumentError with the first issue's message,
 * which commander reports as `error: option '--x <x>' argument 'y' is invalid.
 * <message>` and exits with code 1.
 */
export function zodParser<T>(schema: z.ZodType<T>): (value: string) => T {
  return (value) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      throw new InvalidArgumentError(result.error.issues[0].message)
    }
    return result.data
  }
}

/**
 * A decimal integer of at least `min` (and at most `max`, if given).
 * Rejects empty strings, signs, decimals and exponents such as `1e3`.
 */
export function integer(
  label: string,
  { min, max }: { min: 0 | 1; max?: number }
) {
  const message =
    max !== undefined
      ? `${label} must be an integer between ${min} and ${max}.`
      : `${label} must be a ${min === 0 ? 'non-negative' : 'positive'} integer.`

  const number = z.number().min(min, message)
  return z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(max === undefined ? number : number.max(max, message))
}

/**
 * Comma-separated `key=value` pairs, eg. `env=prod,team=ml`. Values may
 * contain `=`; only the first one separates key from value.
 */
export const keyValuePairs = z
  .string()
  .transform((value) => value.split(','))
  .pipe(
    z.array(
      z
        .string()
        .regex(/^\s*[^=\s][^=]*=/, {
          error: (issue) =>
            `Invalid pair ${JSON.stringify(issue.input)}, expected key=value.`,
        })
        .transform((pair) => {
          const separator = pair.indexOf('=')
          return [
            pair.slice(0, separator).trim(),
            pair.slice(separator + 1).trim(),
          ] as const
        })
    )
  )
  .transform((pairs) => Object.fromEntries(pairs))
