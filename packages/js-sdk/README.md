<p align="center">
  <img width="100" src="https://raw.githubusercontent.com/e2b-dev/E2B/main/readme-assets/logo-circle.png" alt="e2b logo">
</p>

<h1 align="center">
  E2B SDK
</h1>

<!---
<h3 align="center">
  SDK made to control the E2B Sandboxes - secure cloud environments for running LLM-generated code
</h3>
--->
The E2B SDK is made to control the E2B Sandboxes - secure cloud environments for running LLM-generated code. The SDK lets you give your AI app a custom code interpreter.

- ✔️ Works with any LLM and AI framework (see [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) for examples)
- ✔️ Supports streaming content like charts and stdout, stderr
- ✔️ Python & JS SDK
- ✔️ Runs on serverless and edge functions
- ✔️ Runs AI-generated code in secure sandboxed environments
- ✔️ 100% open source (including [infrastructure](https://github.com/e2b-dev/infra))


##### 💻 Supported language runtimes
- ✔️ Python
- [(Beta)](https://e2b.dev/docs/guide/beta-code-interpreter-language-runtimes) JavaScript, R, Java


<!---
<img width="100%" src="/readme-assets/preview.png" alt="Cover image">

--->

<h4 align="center">
  <a href="https://pypi.org/project/e2b/">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/pypi/dm/e2b?label=PyPI%20Downloads">
  </a>
  <a href="https://www.npmjs.com/package/e2b">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/npm/dm/e2b?label=NPM%20Downloads">
  </a>
</h4>

---
### What is E2B?

[E2B](https://www.e2b.dev/) is an open-source runtime for running AI-generated code in secure cloud Sandboxes. It's tailor-made for agentic & AI use cases.

<!---
<h4 align="center">
  <a href="https://e2b.dev/docs">Docs</a> |
  <a href="https://e2b.dev">Website</a> |
  <a href="https://discord.gg/U7KEcGErtQ">Discord</a> |
  <a href="https://twitter.com/e2b_dev">Twitter</a>
</h4>
--->


<div align='center'>
<!-- <a href="https://e2b.dev/docs" target="_blank">
<img src="https://img.shields.io/badge/docs-%2300acee.svg?color=143D52&style=for-the-badge&logo=x&logoColor=white" alt=docs style="margin-bottom: 5px;"/></a>  -->
<a href="https://twitter.com/e2b_dev" target="_blank">
<img src="https://img.shields.io/badge/x (twitter)-%2300acee.svg?color=000000&style=for-the-badge&logo=x&logoColor=white" alt=linkedin style="margin-bottom: 5px;"/></a> 
<a href="https://discord.com/invite/U7KEcGErtQ" target="_blank">
<img src="https://img.shields.io/badge/discord -%2300acee.svg?color=143D52&style=for-the-badge&logo=discord&logoColor=white" alt=discord style="margin-bottom: 5px;"/></a> 
<a href="https://www.linkedin.com/company/e2b-dev/" target="_blank">
<img src="https://img.shields.io/badge/linkedin-%2300acee.svg?color=000000&style=for-the-badge&logo=linkedin&logoColor=white" alt=linkedin style="margin-bottom: 5px;"/></a> 
</div align='center'>


### E2B Sandbox
E2B Sandbox is a secure cloud environment that allows AI agents and apps. You can run multiple instances of Sandboxes, and have long-running sessions. Inside the Sandboxes, LLMs can use the same tools as humans do, e.g.:

- Running LLM generated code
- Cloud browsers
- GitHub repositories and CLIs
- Coding tools like linters, autocomplete, "go-to defintion"
- Audio & video editing


## Getting Started & Documentation

Please visit [documentation](https://e2b.dev/docs) to get started.

### 1. Install SDK

```
npm i @e2b/code-interpreter
```

### 2. Execute code with code interpreter inside Sandbox

```ts
import { Sandbox } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
await sbx.runCode()('x = 1')

const execution = await sbx.runCode()('x+=1; x')
console.log(execution.text)  // outputs 2

await sandbox.close()
```

### 3. More resources
- Check out the [JavaScript/TypeScript](https://e2b.dev/docs/hello-world/js) and [Python](https://e2b.dev/docs/hello-world/py) "Hello World" guides to learn how to use our SDK.

- See [E2B documentation](https://e2b.dev/docs) to get started.

- Visit our [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) to get inspired by examples with different LLMs and AI frameworks.


## Development

You can use the SDK with a locally running [`envd`](https://github.com/e2b-dev/infra/blob/main/packages/envd) (that usually runs inside the sandbox and allows the SDK to interact with it) by passing `E2B_DEBUG=true` to `.env` or by using `debug: true` in the `Sandbox.create` or `Sandbox.connect` method options.

### Install dependencies

```bash
pnpm install
```

### Generating API clients used by SDK

Check out top-level [README](../../README.md#generating-api-clients-used-by-sdks) for more information.

### Building

For development, you can run the following command to rebuild the SDK on every change:

```bash
pnpm dev
```

### Testing

Use `pnpm test` to run the test suite or `pnpm example` to run the example code.
Pass `E2B_DEBUG=true` to `.env` to run against the locally running envd (usually run via Docker).

> When running with a local environment the environment is not cleaned up after every test run as when running the test againts production. This might lead to some issues when running the tests multiple times and it is good to keep in mind.

___

<div align='center'>
<!-- <a href="https://e2b.dev/docs" target="_blank">
<img src="https://img.shields.io/badge/docs-%2300acee.svg?color=143D52&style=for-the-badge&logo=x&logoColor=white" alt=docs style="margin-bottom: 5px;"/></a>  -->
<a href="https://twitter.com/e2b_dev" target="_blank">
<img src="https://img.shields.io/badge/x (twitter)-%2300acee.svg?color=000000&style=for-the-badge&logo=x&logoColor=white" alt=linkedin style="margin-bottom: 5px;"/></a> 
<a href="https://discord.com/invite/U7KEcGErtQ" target="_blank">
<img src="https://img.shields.io/badge/discord -%2300acee.svg?color=143D52&style=for-the-badge&logo=discord&logoColor=white" alt=discord style="margin-bottom: 5px;"/></a> 
<a href="https://www.linkedin.com/company/e2b-dev/" target="_blank">
<img src="https://img.shields.io/badge/linkedin-%2300acee.svg?color=000000&style=for-the-badge&logo=linkedin&logoColor=white" alt=linkedin style="margin-bottom: 5px;"/></a> 
</div align='center'>