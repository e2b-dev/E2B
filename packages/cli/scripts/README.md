 # CLI Scripts

 This folder contains local helper scripts for the CLI.

 ## pipe_smoke.sh

 This is a quick, manual smoke test for stdin piping through the CLI.
 It lives here (instead of in the automated test suite) because it needs:

 - Live credentials (`E2B_DOMAIN`, `E2B_API_KEY`)
 - A real sandbox created via the API (local mac doesn't play nice)
 - A locally built CLI (`packages/cli/dist/index.js`)

 The intent is to move or mirror this into regular tests later, but im not sure how to do that yet.

 Example usage:

 ```bash
 E2B_DOMAIN=... E2B_API_KEY=... ./pipe_smoke.sh <template-id-or-alias>
 ```
