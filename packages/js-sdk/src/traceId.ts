/**
 * Extract a trace ID from the HTTP response headers of a failed request, so it
 * can be reported to E2B and correlated with server-side traces.
 *
 * The SDK does this for the errors it throws — reach for it when you handle an
 * E2B response yourself.
 *
 * Headers are checked in order:
 * 1. `X-Trace-ID` — used verbatim when present.
 * 2. `X-Cloud-Trace-Context` (GCP edge) — `TRACE_ID/SPAN_ID;o=OPTIONS`,
 *    the part before `/` is the trace ID.
 * 3. `X-Amzn-Trace-Id` (AWS edge) — `Root=1-<8 hex>-<24 hex>;...`, the two
 *    hex parts joined are the 32-hex trace ID the server logs.
 *
 * @param headers Response headers of the failed request.
 *
 * @returns The trace ID, or `undefined` when no trace header is present.
 *
 * @example
 * ```ts
 * import { extractTraceId } from 'e2b'
 *
 * const res = await fetch(url)
 * if (!res.ok) {
 *   const traceId = extractTraceId(res.headers)
 *   throw new Error(`Request failed${traceId ? ` (trace ID: ${traceId})` : ''}`)
 * }
 * ```
 */
export function extractTraceId(headers?: Headers): string | undefined {
  if (!headers) {
    return undefined
  }

  const direct = headers.get('x-trace-id')?.trim()
  if (direct) {
    return direct
  }

  const gcp = headers.get('x-cloud-trace-context')?.split('/')[0]?.trim()
  if (gcp) {
    return gcp
  }

  const aws = headers.get('x-amzn-trace-id')
  if (aws) {
    for (const field of aws.split(';')) {
      const [key, value] = field.trim().split('=')
      if (key?.toLowerCase() !== 'root' || !value) {
        continue
      }

      const match = value.match(/^1-([0-9a-f]{8})-([0-9a-f]{24})$/i)
      return match ? match[1] + match[2] : value
    }
  }

  return undefined
}
