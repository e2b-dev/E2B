---
"@e2b/python-sdk": patch
---

fix(python-sdk): percent-encode git credentials so reserved characters are preserved

`Sandbox.git.clone`/`push` embed credentials into HTTP(S) URLs with
`with_credentials`, which previously interpolated the username and password
straight into the URL. A username or token containing URL-reserved characters
(`@ : / # ?`) produced a corrupted URL and broke git auth. The credentials are
now percent-encoded, matching the JavaScript SDK, which already encodes via the
WHATWG `URL` setters. Alphanumeric tokens are unaffected.
