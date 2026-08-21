---
'e2b': patch
'@e2b/python-sdk': patch
---

Point the two Code Interpreter README links at `code-interpreting/analyze-data-with-ai` instead of the `code-interpreting` section index. The index has no landing page and 307s to that article, dropping the query string on the way, so the UTM parameters were lost before the reader arrived. Linking at the resolved path keeps them.
