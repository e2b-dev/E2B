<p align="center">
  <img width="100" src="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-circle.png" alt="e2b logo">
</p>

<h4 align="center">
  <a href="https://pypi.org/project/e2b/">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/pypi/dm/e2b?label=PyPI%20Downloads">
  </a>
</h4>

<!---
<img width="100%" src="/readme-assets/preview.png" alt="Cover image">
--->
## What is E2B?
[E2B](https://e2b.dev/?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=code-interpreter) is an open-source infrastructure that allows you run to AI-generated code in secure isolated sandboxes in the cloud. To start and control sandboxes, use our [JavaScript SDK](https://www.npmjs.com/package/@e2b/code-interpreter) or [Python SDK](https://pypi.org/project/e2b_code_interpreter).

Source: [packages/code-interpreter-python](https://github.com/e2b-dev/E2B/tree/main/packages/code-interpreter-python)

## Run your first Sandbox

### 1. Install SDK

```
pip install e2b-code-interpreter
```

### 2. Get your E2B API key
1. Sign up to E2B [here](https://e2b.dev/?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=code-interpreter).
2. Get your API key [here](https://e2b.dev/dashboard?tab=keys&utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=code-interpreter).
3. Set environment variable with your API key.
```
E2B_API_KEY=e2b_***
```

### 3. Execute code with code interpreter inside Sandbox

```py
from e2b_code_interpreter import Sandbox

with Sandbox.create() as sandbox:
    sandbox.run_code("x = 1")
    execution = sandbox.run_code("x+=1; x")
    print(execution.text)  # outputs 2
```

### 4. Bind the configuration to a client

The top-level `Sandbox` and `AsyncSandbox` exports read their configuration from the environment variables. To use an explicit configuration — e.g. several API keys or domains in one process — create an `E2B` client and use the resource classes it exposes:

```py
from e2b_code_interpreter import E2B

client = E2B(api_key="e2b_***", domain="e2b.dev")

with client.Sandbox.create() as sandbox:
    execution = sandbox.run_code("x = 1; x += 1; x")

# The async variant is exposed as well.
async_sandbox = await client.AsyncSandbox.create()

# The core resources are bound to the client's configuration as well.
volume = client.Volume.create("my-volume")
exists = client.Template.exists("my-template")
secret = client.Secret.create("openai-api-key", "sk-***")

# The classes can be assigned and used like the top-level ones.
Sandbox = client.Sandbox
paginator = Sandbox.list()
```

Per-call params still take precedence over the client's params, and clients are isolated from each other and from the env-configured top-level exports.

### 5. Check docs
Visit [E2B documentation](https://docs.e2b.dev/?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=code-interpreter).

### 6. E2B cookbook
Visit our [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) to get inspired by examples with different LLMs and AI frameworks.
