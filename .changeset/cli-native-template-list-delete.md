---
'@e2b/cli': minor
'e2b': minor
'@e2b/python-sdk': minor
---

`e2b template list` and `e2b template delete` now use the SDK's `Template.list()` and `Template.delete()`. `TemplateInfo` gains `maxCpuCount` (`max_cpu_count` in Python) for resizable templates.

Breaking: `e2b template list -f json` now prints the SDK's `TemplateInfo` objects (`templateId`, `buildId`, `names`, …) instead of the raw API response (`templateID`, `buildID`, `aliases`, `createdBy`, …), and the pretty table drops the `Created by` column (the API deprecated the creator's email).
