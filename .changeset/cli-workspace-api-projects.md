---
'@e2b/cli': minor
---

`e2b auth login` and `e2b auth configure` list your workspaces and projects from workspace-api instead of the API's `GET /teams`, which created a new API key in every project on each call.

- Login selects the project in your personal workspace. Without one (SSO-only accounts), it selects your only active project or asks which one to use. Blocked projects show a warning.
- Requests go to the selected project's own control plane, so projects outside the default region work.
- `E2B_PROJECT_ID` (and `--project` where available) accepts a project's ID, `prj_` public ID, slug or name.
- workspace-api is reached at `workspace-api.e2b.dev` (for `E2B_DOMAIN` `e2b.app` and `e2b.dev`), or at `E2B_WORKSPACE_API_URL`.
