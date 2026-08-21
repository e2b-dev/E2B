---
"e2b": minor
"@e2b/python-sdk": patch
"@e2b/cli": patch
---

Append the trace ID of failed requests to SDK and CLI error messages. When a
failed API or envd response carries a trace header (`X-Trace-ID`, or the GCP
`X-Cloud-Trace-Context` / AWS `X-Amzn-Trace-Id` edge headers), the error
message now ends with `(trace ID: ...)` so users can include the ID when
reporting the failure to E2B and it can be correlated with server-side traces.
The ID is also readable off the error itself — `error.traceId` in JS,
`exception.trace_id` in Python — so it can be forwarded to your own error
reporting without parsing the message:

```ts
try {
  await sandbox.files.read('/missing')
} catch (error) {
  if (error instanceof SandboxError) {
    reportToSentry({ traceId: error.traceId })
  }
}
```

```python
try:
    sandbox.files.read("/missing")
except SandboxException as error:
    report_to_sentry(trace_id=error.trace_id)
```

Every error class carries the field, but per-domain: the SDK has one root per
domain rather than a single shared base, so narrow to the root for the call you
made — `SandboxError`/`SandboxException` for sandbox operations,
`VolumeError`/`VolumeException` for volumes, `SecretError`/`SecretException` for
secrets, `BuildError`/`BuildException` for template builds, and
`AuthenticationError`/`AuthenticationException`, which is orthogonal to all of
them and can surface from any of these calls.

The error classes take the trace ID as optional constructor context — a trailing
options object in JS (`new SandboxError(message, { traceId })`) and a
keyword-only argument in Python (`SandboxException(message, trace_id=...)`).

Two exported option types describe that context: `ErrorOpts` (`traceId`) and
`ErrorOptsWithStackTrace` (adds `stackTrace`). Only the four classes that are
actually handed a stack trace take the latter — `InvalidArgumentError`,
`TemplateError`, `BuildError`, and `FileUploadError`. Every other class takes
`ErrorOpts`, so passing `stackTrace` to one is a type error instead of being
silently ignored.

**Breaking (JS):** the options object replaces the positional `stackTrace`
parameter on the four classes that had one, so
`new TemplateError(message, stackTrace)` becomes
`new TemplateError(message, { stackTrace })` (likewise `InvalidArgumentError`,
`BuildError`, and `FileUploadError`). TypeScript callers get a compile error on
the old form; plain-JS callers silently lose the stack trace. Python is
unaffected — its exceptions already took a single positional argument.

The header parser is exported too, for callers that handle an E2B response
themselves and want the same ID in their own error: `extractTraceId(headers)`
in JS, `extract_trace_id(headers)` in Python.
