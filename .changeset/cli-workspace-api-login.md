---
'@e2b/cli': minor
---

`e2b auth login` and `e2b auth configure` list projects from the E2B workspace API (`E2B_WORKSPACE_API_URL` overrides it; a deployment without one authenticates with `E2B_API_KEY`) and create the CLI's API key on the chosen project's control plane, instead of calling `GET /teams`, which created a key in every project. Commands send the saved key to that control plane unless `E2B_API_KEY`, `E2B_DOMAIN` or `E2B_API_URL` is set. `configure` deletes the key it replaces and `logout` deletes the CLI's key. The config moves to version 3 to record the key's id and domain; older CLIs treat it as signed out and need `e2b auth login` again.
