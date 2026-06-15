---
"@e2b/python-sdk": patch
---

Anchor file-metadata validation regexes with `\A`/`\Z` instead of `^`/`$`. In Python, `$` also matches just before a trailing newline, so metadata keys or values ending in `\n` passed client-side validation (unlike the JS SDK) and then failed later with an opaque low-level HTTP "illegal header value" error. They are now rejected upfront with `InvalidArgumentException`.
