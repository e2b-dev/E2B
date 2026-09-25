---
'e2b': patch
'@e2b/python-sdk': patch
---

Throw the typed git auth/upstream errors from `git.push()` and `git.pull()` when they fail with username/password credentials, instead of the raw command error (`GitAuthError`/`GitUpstreamError` in JS, `GitAuthException`/`GitUpstreamException` in Python). The auth/upstream failure mapping only ran on the no-credentials path, so pushing or pulling with an expired token surfaced git's exit code and stderr rather than the actionable typed error — even though `git.clone()` applies the same mapping on every path, including the credentials one. The temporary credentials are still stripped from the remote URL before the typed error is thrown.
