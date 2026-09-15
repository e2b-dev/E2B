---
'e2b': patch
'@e2b/python-sdk': patch
---

Reject an unrecognized `format` on `files.read` / `Volume.readFile` (`read_file`) with `InvalidArgumentError` / `InvalidArgumentException` instead of returning None or the file as text.
