---
'e2b': patch
'@e2b/python-sdk': patch
---

Single-source the SDK's assumed `on_timeout`/`onTimeout` default (`kill`) into one module-private constant (`DEFAULT_ON_TIMEOUT`) instead of scattering the literal across validation, and make the `auto_resume`/`autoResume` rejection honest: when `on_timeout` is unset it now says it was not set and to set it to `pause`, rather than blaming an action you never chose. Applies to both the JS (`e2b`) and Python (`@e2b/python-sdk`) SDKs.
