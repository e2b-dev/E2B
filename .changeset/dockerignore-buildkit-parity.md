---
'e2b': patch
'@e2b/python-sdk': patch
---

Match BuildKit when filtering the template build context with `.dockerignore`: a leading `**` followed by literal characters (e.g. `**.txt`) now matches at any depth, a negated pattern matching only a parent directory (e.g. `src/app.ts` then `!src`) no longer re-includes the path, and in the JS SDK `?` and bracket expressions match characters outside the BMP (e.g. emoji) as a single character.
