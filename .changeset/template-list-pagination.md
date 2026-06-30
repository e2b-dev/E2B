---
"@e2b/python-sdk": minor
"e2b": minor
"@e2b/cli": minor
---

Add support for listing templates with pagination via the new `GET /v2/templates` endpoint.

- **JS SDK**: new `Template.list()` returning a `TemplatePaginator` (with `hasNext` and `nextItems()`) that yields `TemplateInfo` items, mirroring `Sandbox.list()`.
- **Python SDK**: new `Template.list()` / `AsyncTemplate.list()` returning `TemplatePaginator` / `AsyncTemplatePaginator` (with `has_next` and `next_items()`) that yield `TemplateInfo`.
- **CLI**: `e2b template list` now paginates through templates, accepts a `-l, --limit` option (default 1000, 100 per page, `0` for no limit), and prints a "Showing first N templates. Use --limit to change." hint when more exist — matching `e2b sandbox list`.

Pagination uses the `limit`/`nextToken` query parameters and the `X-Next-Token` response header, consistent with `Sandbox.list()` / `sandbox list`. The API key is team-scoped, so listing takes no team identifier. An exhausted paginator returns an empty list from `nextItems()` / `next_items()`.
