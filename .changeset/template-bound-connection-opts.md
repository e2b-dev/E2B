---
'e2b': patch
'@e2b/python-sdk': patch
---

Resolve the template API config through a class-level hook so a `TemplateBase` subclass can bind connection options as defaults. The top-level `Template` / `AsyncTemplate` surface is unchanged — it still reads config from per-call options and environment variables. In the Python SDK the terminal template operations (`build`, `build_in_background`, `get_build_status`, `exists`, `alias_exists`, `assign_tags`, `remove_tags`, `get_tags`) became `classmethod`s, with identical signatures for callers.

```ts
import { TemplateBase, Template } from 'e2b'

class MyTemplate extends TemplateBase {
  protected static boundConnectionOpts = { apiKey: 'e2b_...', domain: 'my.e2b.dev' }
}

// uses the bound options
await MyTemplate.exists('my-template')

// per-call options still win
await MyTemplate.exists('my-template', { apiKey: 'e2b_other' })
```

```python
from e2b import Template

class MyTemplate(Template):
    _bound_api_params = {"api_key": "e2b_...", "domain": "my.e2b.dev"}

# uses the bound params
MyTemplate.exists("my-template")

# per-call params still win
MyTemplate.exists("my-template", api_key="e2b_other")
```
