---
'@e2b/cli': patch
---

`e2b sandbox list`, `e2b sandbox snapshot list` and `e2b template list` show the `prj_` ID of the project they list, as a `Project ID` column and as `projectID` in `--format json`. With `E2B_API_KEY`, where the key decides the project, it is left out.
