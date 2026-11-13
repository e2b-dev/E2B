---
'@e2b/cli': minor
---

`E2B_ACCESS_TOKEN` authenticates the CLI with an OAuth access token, for CI and other places without a login. It needs `E2B_PROJECT_ID`, which is the project for every request, like `E2B_API_KEY` decides the project on its own; setting both credentials is refused, and a stored login is ignored while the token is set. `e2b workspace list` and `e2b project list` work with the token alone, to find the project to set; `e2b project use` doesn't work with it. The token is used as is: once it expires, set a new one. The variable once held the dashboard's access tokens, which no longer work: such a value is ignored with a warning, as if the variable were unset.
