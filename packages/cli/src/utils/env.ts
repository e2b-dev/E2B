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
  const [key, ...rest] = value.split('=')
  if (key && rest.length > 0) {
    previous[key] = rest.join('=')
  }
  return previous
}
