<p align="center">
  <img src="/readme-assets/logo-black.png#gh-light-mode-only" alt="E2B Logo" width="200">
  <img src="/readme-assets/logo-white.png#gh-dark-mode-only" alt="E2B Logo" width="200">
</p>

<h4 align="center">
  <a href="https://pypi.org/project/e2b/">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" decoding="async" style="color:transparent;width:170px;height:18px" src="https://static.pepy.tech/personalized-badge/e2b?period=monthly&units=INTERNATIONAL_SYSTEM&left_color=BLACK&right_color=GREEN&left_text=PyPi%20Monthly%20Downloads">
  </a>
  <a href="https://www.npmjs.com/package/e2b">
    <img alt="Last 1 month downloads for the JavaScript SDK" loading="lazy" width="200" height="30" decoding="async" data-nimg="1"
    style="color:transparent;width:170px;height:18px" src="https://img.shields.io/npm/dm/e2b?label=NPM%20Monthly%20Downloads">
  </a>
</h4>

<p align="center">
  <a href="README.md">English</a> · <b>简体中文</b>
</p>

<!---
<img width="100%" src="/readme-assets/preview.png" alt="Cover image">
--->
## 什么是 E2B？
[E2B](https://e2b.dev/?utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=E2B) 是一个开源基础设施，允许您在云端安全隔离的沙盒（Sandboxes）中运行 AI 生成的代码。如需启动并控制沙盒，请使用我们的 [JavaScript SDK](https://www.npmjs.com/package/e2b) 或 [Python SDK](https://pypi.org/project/e2b)。

## 运行您的第一个沙盒

### 1. 安装 SDK

JavaScript / TypeScript
```
npm i e2b
```

Python
```
pip install e2b
```

### 2. 获取您的 E2B API 密钥
1. 在[此处](https://e2b.dev/?utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=E2B)注册 E2B 账号。
2. 在[此处](https://e2b.dev/dashboard?tab=keys&utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=E2B)获取您的 API 密钥。
3. 使用您的 API 密钥设置环境变量：
```
E2B_API_KEY=e2b_***
```

### 3. 启动沙盒并运行命令

JavaScript / TypeScript
```ts
import Sandbox from 'e2b'

const sandbox = await Sandbox.create()
const result = await sandbox.commands.run('echo "Hello from E2B!"')
console.log(result.stdout) // Hello from E2B!
```

Python
```py
from e2b import Sandbox

with Sandbox.create() as sandbox:
    result = sandbox.commands.run('echo "Hello from E2B!"')
    print(result.stdout)  # Hello from E2B!
```

### 4. 使用 Code Interpreter（代码解释器）执行代码

如果您需要通过 [`runCode()`](https://e2b.dev/docs/code-interpreting?utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=E2B)/[`run_code()`](https://e2b.dev/docs/code-interpreting?utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=E2B) 执行代码，请安装 Code Interpreter SDK（[JavaScript](./packages/code-interpreter-js) / [Python](./packages/code-interpreter-python)）：

```
npm i @e2b/code-interpreter  # JavaScript/TypeScript
pip install e2b-code-interpreter  # Python
```

```ts
import { Sandbox } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
const execution = await sandbox.runCode('x = 1; x += 1; x')
console.log(execution.text)  // outputs 2
```

### 5. 使用 Desktop 进行计算机操作（Computer Use）

如需使用鼠标、键盘、屏幕截图、应用程序控制以及桌面流式传输 API，请安装 Desktop SDK（[JavaScript](./packages/desktop-js) / [Python](./packages/desktop-python)）：

```
npm i @e2b/desktop  # JavaScript/TypeScript
pip install e2b-desktop  # Python
```

```ts
import { Sandbox } from '@e2b/desktop'

const desktop = await Sandbox.create()
await desktop.launch('google-chrome')
const screenshot = await desktop.screenshot()
```

### 6. 查看官方文档
访问 [E2B 官方文档](https://e2b.dev/docs?utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=E2B)。

### 7. E2B Cookbook 示例集
访问我们的 [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main)，从结合不同大语言模型（LLM）与 AI 框架的丰富示例中获取灵感。

## 私有化自托管（Self-hosting）

请阅读 [Embed 部署指南](https://github.com/e2b-dev/runtime/blob/main/embed/README.md)，了解如何自行搭建与部署 [E2B Runtime](https://github.com/e2b-dev/runtime)。底层基础设施使用 Terraform 进行部署。

支持的云服务提供商：
- 🟢 AWS
- 🟢 Google Cloud (GCP)
- 🟢 Azure
- 🟢 通用 Linux 主机（通过 Embed 部署）

---

> **翻译说明（Translation Disclaimer）**
> 本文档由社区志愿者（[@JasonYeYuhe](https://github.com/JasonYeYuhe)）人工翻译并维护，旨在降低中文开发者的阅读门槛。最后同步日期：2026年10月26日。若译文与英文原版存在任何出入或滞后，请以 [英文原版 (README.md)](README.md) 为准。欢迎通过 PR 协助改进译文！
