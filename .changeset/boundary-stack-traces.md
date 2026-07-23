---
'e2b': patch
'@e2b/python-sdk': patch
---

Select template build-step stack-trace frames by SDK boundary instead of fixed depth. The caller's frame is now the first one whose file lies outside the SDK package, so traces stay correct when transpilers inject extra frames (e.g. TS class-field initializers) or runtimes elide delegating frames (e.g. Bun's tail-call elision).
