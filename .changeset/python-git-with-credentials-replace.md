---
'e2b': patch
'@e2b/python-sdk': patch
---

Fix `with_credentials` in the deprecated `sandbox.git` module: replace credentials already embedded in an HTTP(S) clone URL instead of prepending a second `userinfo`, and URL-encode the supplied username and password.
