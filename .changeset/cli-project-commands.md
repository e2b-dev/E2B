---
'@e2b/cli': minor
---

Add commands for workspaces and projects:

```sh
e2b workspace list                    # workspaces you can access
e2b project list [--workspace <ws>]   # projects, the current one marked with *
e2b project use <project>             # set the project commands run in
e2b project info                      # the current project and why it is current
```

A project can be given by its ID, `prj_` ID, slug or name. Commands run in the project from `E2B_PROJECT_ID`, then the one chosen with `e2b project use` (or `e2b auth configure`, which picks it interactively). With `E2B_API_KEY` set, the API key determines the project.
