---
name: testing-cli-tables
description: How to build and end-to-end test the E2B CLI (table output, sandbox lifecycle) against the real API.
---

# Testing the E2B CLI end-to-end

- Build: `source ~/.nvm/nvm.sh && nvm use 24 && pnpm --filter @e2b/cli build`; run via `node packages/cli/dist/index.js ...` (alias `e2b`).
- Auth: the CLI reads `E2B_API_KEY` from the environment (packages/cli/src/api.ts); no `e2b auth login` needed when the key is set.
- Create a sandbox non-interactively with `e2b sandbox create base -d` (detach); it prints the sandbox ID. Kill with `e2b sandbox kill <id>`.
- The team account often has other live sandboxes/snapshots, so the true empty state may be unreachable; use a non-matching metadata filter instead: `e2b sandbox list --metadata nomatch=zzz` → "No sandboxes found".
- `template list` and `snapshot list` outputs are long; pipe through `head` when capturing screenshots. In a 1024px-wide GUI terminal, shrink the Konsole font (Ctrl+minus x2) so wide tables don't wrap.
- JSON check: `e2b <cmd> --format json | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'`.
- To create a sandbox with custom metadata (no CLI flag exists), use the JS SDK: build it first (`pnpm --filter e2b build`), then `require('/path/to/repos/E2B/packages/js-sdk')` from a script. Note: typing CJK/emoji via computer-use keyboard drops the characters — write the script to a file with the write tool and run `node /tmp/script.js` in the terminal instead.
- To exercise the table renderer directly (e.g. wide chars in a padded middle column), run a small script importing `packages/cli/src/utils/table.ts` with `npx tsx`.

## Devin Secrets Needed
- `E2B_API_KEY`
