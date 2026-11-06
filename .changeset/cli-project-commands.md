---
'@e2b/cli': minor
---

Add commands for workspaces and projects, and a `--project` option on every command that calls the E2B API:

```sh
e2b workspace list                       # workspaces you can access
e2b project list [--workspace <ws>]      # projects, the current one marked with *
e2b project use <project>                # set the default project
e2b project info [--project <project>]   # the current project, or another one
e2b sandbox list --project <project>     # run any command in another project
```

A project can be given by its ID, `prj_` ID, slug or name. The project a command runs in is `--project`, then `E2B_PROJECT_ID`, then the one chosen with `e2b project use` (or `e2b auth configure`, which picks it interactively). With `E2B_API_KEY` set, the API key determines the project and `--project` is ignored with a warning. `template list` keeps its `-t` short flag.
