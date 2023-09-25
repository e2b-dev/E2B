<h1 align="center">
<span style="font-size:48px;"><b>E2B JavaScript & TypeScript SDK</b></span>
</h1>

<h4 align="center">
  <a href="https://e2b.dev/docs">Docs</a> |
  <a href="https://e2b.dev">Website</a> |
  <a href="https://discord.gg/U7KEcGErtQ">Discord</a> |
  <a href="https://twitter.com/e2b_dev">Twitter</a>
</h4>

<h4 align="center">
  <a href="https://discord.gg/U7KEcGErtQ">
    <img src="https://img.shields.io/badge/chat-on%20Discord-blue" alt="Discord community server" />
  </a>
  <a href="https://twitter.com/e2b_dev">
    <img src="https://img.shields.io/twitter/follow/infisical?label=Follow" alt="e2b Twitter" />
  </a>
</h4>

[E2B](https://e2b.dev) (_english2bits_) is a cloud operating system for AI agents. 

With a single line of our SDK, you can give your AI agent a sandboxed cloud environment where your agent can do any of the following:
- Run any code
- Run any terminal command
- Install dependencies and programs
- Use filesystem
- Upload and download files
- Access the internet
- Start a web server that's accessible from the internet
- Clone git repositories
- Start any process (even long-running such as a database)

This just a few examples of what can be done with our agent cloud environments.

**Our SDK works with any AI agent (no matter what framework, you're using), and without the need to manage any infrastructure.**

## Getting Started & Documentation

Visit [docs](https://e2b.dev/docs) to get started with the SDK.

### Installation
```bash
npm install @e2b/sdk
```


## Development

#### Note about uuid package

Our `js-sdk` use `rpc-websocket-client` package, which depends on `uuid@3` package.
`uuid@3` is deprecated for a long time and causing security warnings when installing e2b cli (because it depends on this package – js-sdk).
To quickfix this, but also to avoid forking `rpc-websocket-client`, we use pnpm patching feature to replace uuid@3 with uuid@9 within `rpc-websocket-client` package.

```
cd packages/js-sdk
pnpm patch rpc-websocket-client
code <generated-path>
// edit package.json to replace uuid@3 with uuid@8
// replace every `var v1 = require('uuid/v1');` with `var { v1 } = require('uuid');`
pnpm patch-commit <generated-path>
git commit -m "patch uuid@3 to uuid@9"
```
