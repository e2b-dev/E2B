---
"@e2b/python-sdk": patch
---

Percent-encode the username and password when embedding HTTP(S) Git credentials into a clone URL. Previously they were inserted raw, so a username or token containing URL-significant characters (`@`, `/`, `:`, spaces, etc.) produced a malformed URL that git could not use. This now matches the JS SDK, which already encodes the credentials.
