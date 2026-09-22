<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-white.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-black.png">
    <img alt="E2B Logo" src="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-black.png" width="200">
  </picture>
</p>

<h4 align="center">  
  <a href="https://www.npmjs.com/package/e2b">
    <img alt="Last 1 month downloads for the JavaScript SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/npm/dm/e2b?label=NPM%20Downloads">
  </a>
</h4>

<!---
<img width="100%" src="/readme-assets/preview.png" alt="Cover image">
--->
## What is E2B?
[E2B](https://e2b.dev/?utm_source=npm&utm_medium=referral&utm_campaign=readme&utm_content=e2b) is an open-source infrastructure that allows you to run AI-generated code in secure isolated sandboxes in the cloud. To start and control sandboxes, use our [JavaScript SDK](https://www.npmjs.com/package/e2b) or [Python SDK](https://pypi.org/project/e2b).

## Run your first Sandbox

### 1. Install SDK

```bash
npm i e2b
```

### 2. Get your E2B API key
1. Sign up to E2B [here](https://e2b.dev/?utm_source=npm&utm_medium=referral&utm_campaign=readme&utm_content=e2b).
2. Get your API key [here](https://e2b.dev/dashboard?tab=keys&utm_source=npm&utm_medium=referral&utm_campaign=readme&utm_content=e2b).
3. Set environment variable with your API key
```
E2B_API_KEY=e2b_***
```

### 3. Start a sandbox and run commands

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create()
const result = await sandbox.commands.run('echo "Hello from E2B!"')
console.log(result.stdout) // Hello from E2B!
```

### 4. Bind the configuration to a client

The top-level `Sandbox`, `Volume`, `Template` and `Secret` exports read their configuration from the environment variables. To use an explicit configuration — e.g. several API keys or domains in one process — create an `E2B` client and use the resources it exposes:

```ts
import { E2B } from 'e2b'

const client = new E2B({ apiKey: 'e2b_***', domain: 'e2b.dev' })

const sandbox = await client.Sandbox.create()
const volume = await client.Volume.create('my-volume')
const exists = await client.Template.exists('my-template')
await client.Secret.create('openai-api-key', 'sk-***')

// The classes can be destructured and used like the top-level ones.
const { Sandbox } = client
const paginator = Sandbox.list()
```

Per-call options still take precedence over the client's options, and clients are isolated from each other and from the env-configured top-level exports.

### 5. Code execution with Code Interpreter

If you need [`runCode()`](https://docs.e2b.dev/code-interpreting/analyze-data-with-ai?utm_source=npm&utm_medium=referral&utm_campaign=readme&utm_content=e2b), install the [Code Interpreter SDK](https://github.com/e2b-dev/code-interpreter):

```bash
npm i @e2b/code-interpreter
```

```ts
import { Sandbox } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
const execution = await sandbox.runCode('x = 1; x += 1; x')
console.log(execution.text)  // outputs 2
```

### 6. Check docs
Visit [E2B documentation](https://docs.e2b.dev/?utm_source=npm&utm_medium=referral&utm_campaign=readme&utm_content=e2b).

### 7. E2B cookbook
Visit our [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) to get inspired by examples with different LLMs and AI frameworks.
