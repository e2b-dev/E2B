/**
 * Commander arg parser for repeatable `--env KEY=VALUE` flags.
 *
 * Accumulates parsed pairs into `previous` so the flag can be passed multiple
 * times. Values may contain `=` (only the first `=` separates key from value).
 */
export function parseEnv(
  value: string,
  previous: Record<string, string>
): Record<string, string> {
  const [key, ...rest] = value.split('=')
  if (key && rest.length > 0) {
    previous[key] = rest.join('=')
  }
  return previous
}
