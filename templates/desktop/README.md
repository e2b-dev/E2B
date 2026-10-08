# E2B Desktop Template

This is the template for the E2B Desktop Sandbox.

## Building the production template

The official `desktop` template is built by the
[`templates.yml`](../../.github/workflows/templates.yml) workflow on every push to
`main` that touches this directory (or manually via `workflow_dispatch`). It
uses the Python SDK from this repo (`packages/python-sdk`), so the build scripts
run in that package's uv environment.

1. Install the build dependencies:

```bash
uv sync --project ../../packages/python-sdk
```

2. Provide your credentials in `.env`:

```
E2B_API_KEY=e2b_***
```

3. Build the template:

```bash
uv run --project ../../packages/python-sdk python build_prod.py
```

During development you can build the `desktop-dev` template instead:

```bash
uv run --project ../../packages/python-sdk python build_dev.py
```

If you want to customize the Desktop sandbox (e.g.: add a preinstalled package)
you can do that by creating a [custom sandbox template](https://e2b.dev/docs/template/quickstart).

## Creating a custom template

1. Install E2B SDK

```bash
pip install e2b dotenv
```

2. Create a custom sandbox template:

**template.py**

```python
from e2b import Template

template = Template().from_template("desktop")
```

3. Create a build script:

**build.py**

```python
from dotenv import load_dotenv
from template import template
from e2b import Template, default_build_logger

load_dotenv()

Template.build(
    template,
    alias="desktop-custom",
    cpu_count=8,
    memory_mb=8192,
    on_build_logs=default_build_logger(),
)
```

4. Set your environment variables in a `.env` file (loaded by `load_dotenv()`):

```
E2B_API_KEY=e2b_***
```

5. Build the template:

```bash
python build.py
```

6. Use the custom template:

**Python**

```python
from e2b_desktop import Sandbox

desktop = Sandbox.create(template="desktop-custom")
```

**JavaScript**

```javascript
import { Sandbox } from '@e2b/desktop'

const desktop = await Sandbox.create('desktop-custom')
```
