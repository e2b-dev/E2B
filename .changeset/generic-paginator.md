---
"@e2b/python-sdk": patch
"e2b": patch
---

Introduce a generic, reusable paginator base class and migrate the sandbox and snapshot list paginators onto it. The base owns the shared cursor-based pagination state (`hasNext`/`has_next`, `nextToken`/`next_token`, and reading the `x-next-token` header) while each concrete paginator implements `nextItems`/`next_items` to fetch its own page, so future list endpoints can add pagination by subclassing it without reimplementing the bookkeeping. No public API changes.
