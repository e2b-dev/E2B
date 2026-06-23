---
"e2b": patch
"@e2b/python-sdk": patch
---

Simplify the internal `getAllFilesInPath` template helper to expand directory patterns with a single glob call (`[src, src/**/*]`) instead of re-globbing each matched directory. No change to observable behavior.
