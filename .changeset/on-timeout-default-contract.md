---
'e2b': patch
---

Single-source the SDK's assumed `on_timeout`/`onTimeout` default (`kill`) into one documented constant (`DEFAULT_ON_TIMEOUT`) instead of scattering the literal across validation and docs, and make the `auto_resume`/`autoResume` rejection honest: when `on_timeout` is unset it now says the action defaulted to `kill` and tells you to set it to `pause`, rather than blaming an action you never chose.
