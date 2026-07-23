---
'e2b': patch
'@e2b/python-sdk': patch
---

Select template build-step stack-trace frames by SDK boundary instead of fixed depth. The caller's frame is now the first one whose file lies outside the SDK package, so traces stay correct when transpilers inject extra frames (e.g. TS class-field initializers) or runtimes elide delegating frames (e.g. Bun's tail-call elision). The suppress/override stack-trace collection machinery this made redundant (`runInNewStackTraceContext`, `runInStackTraceOverrideContext` and their Python equivalents) is removed. Errors that carry a template-definition stack trace now keep their `Name: message` header in `error.stack` (previously the raw frames replaced the whole stack, hiding the failure message from reporters that print `error.stack`), and the SDK-internal throw site remains reachable on `error.cause`.
