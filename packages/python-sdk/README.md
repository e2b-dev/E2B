<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-white.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-black.png">
    <img alt="E2B Logo" src="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-black.png" width="200">
  </picture>
</p>

<h4 align="center">
  <a href="https://pypi.org/project/e2b/">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" decoding="async" style="color:transparent;width:170px;height:18px" src="https://static.pepy.tech/personalized-badge/e2b?period=monthly&units=INTERNATIONAL_SYSTEM&left_color=BLACK&right_color=GREEN&left_text=PyPi%20Monthly%20Downloads">
  </a>  
</h4>


## What is E2B?
[E2B](https://e2b.dev/?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=e2b) is an open-source infrastructure that allows you to run AI-generated code in secure isolated sandboxes in the cloud. To start and control sandboxes, use our [JavaScript SDK](https://www.npmjs.com/package/e2b) or [Python SDK](https://pypi.org/project/e2b).

## Run your first Sandbox

### 1. Install SDK

```
pip install e2b
```

### 2. Get your E2B API key
1. Sign up to E2B [here](https://e2b.dev/?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=e2b).
2. Get your API key [here](https://e2b.dev/dashboard?tab=keys&utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=e2b).
3. Set environment variable with your API key
```
E2B_API_KEY=e2b_***
```

### 3. Start a sandbox and run commands

```py
from e2b import Sandbox

with Sandbox.create() as sandbox:
    result = sandbox.commands.run('echo "Hello from E2B!"')
    print(result.stdout)  # Hello from E2B!
```

### 4. Bind the configuration to a client

The top-level `Sandbox`, `AsyncSandbox`, `Volume`, `AsyncVolume`, `Template`, `AsyncTemplate` and `Secret` exports read their configuration from the environment variables. To use an explicit configuration — e.g. several API keys or domains in one process — create an `E2B` client and use the resource classes it exposes:

```py
from e2b import E2B

client = E2B(api_key="e2b_***", domain="e2b.dev")

sandbox = client.Sandbox.create()
volume = client.Volume.create("my-volume")
exists = client.Template.exists("my-template")
secret = client.Secret.create("openai-api-key", "sk-***")

# The async variants are exposed as well.
async_sandbox = await client.AsyncSandbox.create()

# The classes can be assigned and used like the top-level ones.
Sandbox = client.Sandbox
paginator = Sandbox.list()
```

Per-call params still take precedence over the client's params, and clients are isolated from each other and from the env-configured top-level exports.

### High-concurrency sandbox streams

The Python SDK spreads sandbox `commands` and `files` traffic across four HTTP/2 connection pools by default. This prevents long-running streams in one process from all contending for a single connection's concurrent-stream limit.

If one process needs more capacity, set `E2B_ENVD_POOL_SHARDS` before importing `e2b`. Each additional shard can open another connection to the sandbox host, so increase it only as needed:

```sh
E2B_ENVD_POOL_SHARDS=8 python eval.py
```

### 5. Code execution with Code Interpreter

If you need [`run_code()`](https://docs.e2b.dev/code-interpreting/analyze-data-with-ai?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=e2b), install the [Code Interpreter SDK](https://github.com/e2b-dev/code-interpreter):

```
pip install e2b-code-interpreter
```

```py
from e2b_code_interpreter import Sandbox

with Sandbox.create() as sandbox:
    execution = sandbox.run_code("x = 1; x += 1; x")
    print(execution.text)  # outputs 2
```

### 6. Check docs
Visit [E2B documentation](https://docs.e2b.dev/?utm_source=pypi&utm_medium=referral&utm_campaign=readme&utm_content=e2b).

### 7. E2B cookbook
Visit our [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) to get inspired by examples with different LLMs and AI frameworks.
