---
'@e2b/cli': minor
---

Report CLI status to the terminal with the [Program Status Protocol](https://www.superlogical.com/rex/docs/build/program-status) (OSC 7501):

- `e2b template create` reports `working` while building, then `done` or `error`
- `e2b auth login` reports `blocked` (`auth`) while waiting for the browser login
- confirmation prompts and `e2b auth configure` report `blocked` while waiting for an answer

Reports are only written when stdout or stderr is a terminal.
