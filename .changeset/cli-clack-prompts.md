---
'@e2b/cli': patch
---

Interactive prompts (`template init`, `template migrate`, `template delete`/`publish` confirmations, project pickers) now use `@clack/prompts` instead of Inquirer. Canceling a prompt (Ctrl+C or Esc) prints `Canceled` and exits with code 130.
