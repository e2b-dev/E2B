---
'e2b': minor
'@e2b/python-sdk': minor
---

Add `Template.getInfo(nameOrId)` (`get_info` in Python), which returns a template with its default build as `TemplateDetails`, and `Template.listBuilds(nameOrId, { statuses, tags })` (`list_builds` in Python), which returns a `TemplateBuildPaginator` (`AsyncTemplateBuildPaginator` for `AsyncTemplate`) over the template's builds, newest first. Each build carries its `cpuCount`, `maxCpuCount` and the tags that point at it, so `Template.listBuilds('my-template', { tags: ['v2'] })` reads the build a tag points at. `getInfo` and fetching a page of builds throw the new `TemplateNotFoundError` (`TemplateNotFoundException` in Python), a subclass of `TemplateError`, when the template is not found. Both methods take a name or ID without a tag and throw `InvalidArgumentError` (`InvalidArgumentException` in Python) for `name:tag`.
