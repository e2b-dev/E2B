---
'@e2b/cli': minor
---

`e2b auth login` and `e2b auth configure` list your workspaces and projects from workspace-api instead of the API's `GET /teams`, which created a new API key in every project on each call.

- Login asks for the workspace and then the project, with your personal workspace and its project preselected. Without a terminal, the personal project (or your only active one) is used. `e2b auth configure` asks the same way, with the current project preselected. Blocked projects show a warning.
- Requests go to the selected project's own control plane, so projects outside the default region work.
- `E2B_PROJECT_ID` (and `--project` where available) accepts a project's ID, `prj_` public ID, slug or name.
- workspace-api is reached at `workspace-api.e2b.dev` (for `E2B_DOMAIN` `e2b.app` and `e2b.dev`), or at `E2B_WORKSPACE_API_URL`. Logging in needs it: on any other `E2B_DOMAIN`, use `E2B_API_KEY`.
