---
'e2b': patch
---

fix(js-sdk): skip empty PTY chunks in the command stream to match the Python SDK - `onPty` no longer receives empty chunks; the Python SDK (sync and async) guards every output case with `if chunk`, and an empty `Uint8Array` is truthy so the length is checked explicitly.
