---
'@e2b/python-sdk': patch
'e2b': patch
---

Fix signed URL expiration edge cases in `uploadUrl`/`downloadUrl` (`upload_url`/`download_url`):

- Python now raises `InvalidArgumentException` when `use_signature_expiration` is passed for an unsecured sandbox, matching the JS SDK behavior (which now throws `InvalidArgumentError` instead of a plain `Error`).
- A signature expiration of `0` now produces an immediately expiring URL instead of silently creating a never-expiring one.
