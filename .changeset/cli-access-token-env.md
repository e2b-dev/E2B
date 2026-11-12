---
'@e2b/cli': minor
---

`E2B_ACCESS_TOKEN` authenticates the CLI with an OAuth access token, for CI and other places without a login. Setting it together with `E2B_API_KEY` is refused; a stored login is ignored while the token is set. The project comes from `E2B_PROJECT_ID`, else the token's user's personal project (or their only active one). Workspace and project commands work with it, `e2b project use` doesn't (set `E2B_PROJECT_ID` instead). The token is used as is: once it expires, set a new one. The variable once held the dashboard's access tokens, which no longer work: such a value is rejected with a message to unset it.
