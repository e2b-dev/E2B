---
'e2b': patch
---

Bump both undici dependencies past the 2026-07-24 security advisories: the required `undici` from `^7.28.0` to `^7.29.0`, and the optional `undici8` (`npm:undici@…`) from 8.8.0 to 8.10.0. Both releases fix one High ([GHSA-4cwx-7wf7-3272](https://github.com/nodejs/undici/security/advisories/GHSA-4cwx-7wf7-3272)) and four Medium advisories, and undici 8.10.0 additionally fixes HTTP/2 request settling, refused-stream retries and GOAWAY handling, which the SDK exercises because every dispatcher it builds sets `allowH2: true`. Neither bump moves a Node floor — 7.29.0 still requires Node `>=20.18.1` and 8.10.0 still requires `>=22.19.0`, matching the `UNDICI_8_MIN_NODE` gate — so package selection and behaviour are unchanged.
