---
"@e2b/python-sdk": minor
"e2b": minor
"@e2b/cli": minor
---

Add support for listing templates with pagination via the new `GET /v2/templates` endpoint.

- **JS SDK**: new `Template.list()` returning a `TemplatePaginator` (with `hasNext` / `nextItems()`), matching `Sandbox.list()`. Items are returned as `TemplateInfo`.
- **Python SDK**: new `Template.list()` / `AsyncTemplate.list()` returning `TemplatePaginator` / `AsyncTemplatePaginator`, yielding `TemplateInfo`.
- **CLI**: `e2b template list` now pages through templates (via the SDK paginator) and accepts a `-l, --limit` option (default 1000, `0` for no limit), printing a "Showing first N templates. Use --limit to change." hint when more exist.

Pagination uses the `limit`/`nextToken` query parameters and the `X-Next-Token` response header, consistent with `sandbox list` / `Sandbox.list()`.
