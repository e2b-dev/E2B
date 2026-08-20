---
'e2b': patch
'@e2b/python-sdk': patch
---

Scope user-code stack trace attachment to template and build code: generic error classes and API error helpers no longer accept caller stack traces; template/build call sites attach them explicitly instead.
