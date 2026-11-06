---
'@e2b/cli': minor
---

The CLI now authenticates every request with your login's access token instead of a stored API key.

- `e2b auth login` opens `https://e2b.dev/auth/cli` (or `https://$E2B_DOMAIN/auth/cli`). The `E2B_DOCS_BASE` override is removed.
- Access tokens are refreshed automatically before they expire, including during long-running commands such as `sandbox logs --follow`, `sandbox metrics --follow` and an attached `sandbox create` session. Refreshes are serialized across concurrent `e2b` processes, so running several commands at once no longer risks signing you out.
- `--project`, `E2B_PROJECT_ID` and the project chosen with `e2b auth configure` select the project for each request.
- The project API key is no longer stored in `~/.e2b/config.json`. A key saved by an earlier version is removed the next time the config is written. CLI versions released before this one treat a config without it as signed out, so after downgrading, run `e2b auth login` again.
- `E2B_API_KEY` still works and takes precedence, for CI/CD and other non-interactive use.
