---
'e2b': patch
---

Resolve the template builder's default file context path in the constructor instead of a class field initializer. Under `[[Define]]` class-field semantics (the default at `target: es2022+`), field initializers run in an extra `<instance_members_initializer>` stack frame, which threw off the fixed-depth caller-directory resolution — `.copy()` sources resolved against the SDK's own directory instead of the caller's. The constructor-body call is emit-invariant, so the `useDefineForClassFields: false` pin in tsconfig is no longer needed and has been removed.
