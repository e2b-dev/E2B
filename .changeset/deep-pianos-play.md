---
'@e2b/desktop': patch
'@e2b/desktop-python': patch
---

Preserve allocation ownership when desktop startup and cleanup both fail. The
desktop SDKs now expose a typed failure with the sandbox ID, original startup
cause and cleanup failure so callers can attempt targeted reclamation. Startup
errors remain unchanged when cleanup succeeds or the sandbox is already absent.
