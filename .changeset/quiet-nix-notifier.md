---
'@e2b/cli': patch
---

Skip the update check when the `NO_UPDATE_NOTIFIER` environment variable is set, so system package managers (for example Nix) can install the CLI without it suggesting updates they cannot apply. Help output now always names the program `e2b` instead of echoing the entrypoint file name.
