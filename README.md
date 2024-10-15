<p align="center">
  <img width="100" src="/readme-assets/logo-circle.png" alt="e2b logo">
</p>


<h1 align="center">
  E2B SDK
</h1>

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

<!---
<img width="100%" src="/readme-assets/preview.png" alt="Cover image">

--->

---
### What is E2B?

[E2B](https://www.e2b.dev/) is an open-source runtime for running AI-generated code in secure cloud Sandboxes. It's tailor-made for agentic & AI use cases.

### E2B Sandbox
E2B Sandbox is a secure cloud environment that allows AI agents and apps. You can run multiple instances of Sandboxes, and have long-running sessions. Inside the Sandboxes, LLMs can use the same tools as humans do, e.g.:

- Running LLM generated code
- Cloud browsers
- GitHub repositories and CLIs
- Coding tools like linters, autocomplete, "go-to defintion"
- Audio & video editing

<!---
<h3 align="center">
  SDK made to control the E2B Sandboxes - secure cloud environments for running LLM-generated code
</h3>
--->

### E2B SDK

The E2B SDK is made to control the E2B Sandboxes - secure cloud environments for running LLM-generated code. The SDK lets you give your AI app a custom code interpreter.

- ✔️ Works with any LLM and AI framework (see [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) for examples)
- ✔️ Supports streaming content like charts and stdout, stderr
- ✔️ Python & JS SDK
- ✔️ Runs on serverless and edge functions
- ✔️ Runs AI-generated code in secure sandboxed environments
- ✔️ 100% open source (including [infrastructure](https://github.com/e2b-dev/infra))


##### 💻 Supported language runtimes
- ✔️ Python
- JavaScript
- R
- Java


<h1 align="center">
  Start with E2B SDK
</h1>


### 1. Install SDK

JavaScript/TypeScript
```
npm i @e2b/code-interpreter
```

Python
```
pip install e2b_code_interpreter
```

### 2. Execute code with code interpreter inside Sandbox

**JavaScript**
```ts
import { CodeInterpreter } from '@e2b/code-interpreter'

const sandbox = await CodeInterpreter.create()
await sandbox.notebook.execCell('x = 1')

const execution = await sandbox.notebook.execCell('x+=1; x')
console.log(execution.text)  // outputs 2

await sandbox.close()
```

**Python**
```py
from e2b_code_interpreter import CodeInterpreter

with CodeInterpreter() as sandbox:
    sandbox.notebook.exec_cell("x = 1")

    execution = sandbox.notebook.exec_cell("x+=1; x")
    print(execution.text)  # outputs 2
```

### 3. More resources
> Check out the [JavaScript/TypeScript](https://e2b.dev/docs/hello-world/js) and [Python](https://e2b.dev/docs/hello-world/py) "Hello World" guides to learn how to use our SDK.

> See [E2B documentation](https://e2b.dev/docs) to get started.

> Visit our [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) to get inspired by examples with different LLMs and AI frameworks.


## Repository Structure

This repository is a monorepo containing:

1. [Python SDK](/packages/python-sdk)
1. [JS SDK](/packages/js-sdk)
1. [CLI](/packages/cli)
1. [Documentation](/apps/web/)

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