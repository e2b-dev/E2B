---
'@e2b/cli': patch
---

Remove the `E2B_ACCESS_TOKEN` auth path. Authentication moved to Hydra OAuth, so the CLI no longer reads an access token — from the environment or from `~/.e2b/config.json` — to authorize API requests. The API key alone scopes every endpoint the CLI calls, and `e2b auth login` / `e2b auth configure` build their own clients with Hydra JWTs.
