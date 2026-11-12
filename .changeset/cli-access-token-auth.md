---
'@e2b/cli': minor
---

The CLI now authenticates every request with your login's access token instead of a stored API key.

- `e2b auth login` opens `https://e2b.dev/auth/cli` (or `https://$E2B_DOMAIN/auth/cli`). The `E2B_DOCS_BASE` override is removed.
- Access tokens are refreshed automatically before they expire, including during long-running commands such as `sandbox logs --follow`, `sandbox metrics --follow` and an attached `sandbox create` session. Refreshes are serialized across concurrent `e2b` processes, so running several commands at once no longer risks signing you out.
- `--project`, `E2B_PROJECT_ID` and the project chosen with `e2b auth configure` select the project for each request.
- The project API key in `~/.e2b/config.json` plays no role any more: it is neither used for requests nor written by `e2b auth login`. After downgrading to a CLI version that authenticates with it, run `e2b auth login` again.
- `E2B_API_KEY` still works and takes precedence, for CI/CD and other non-interactive use.
