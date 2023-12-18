<p align="center">
  <img width="100" src="/readme-assets/logo-circle.png" alt="e2b logo">
</p>

<h1 align="center">
  Cloud Runtime for AI Agents
</h1>

<h3 align="center">
  Secure sandboxed cloud environments made for AI agents and AI apps
</h3>

<h4 align="center">
  <!-- Look, mom, I'm on the internet! -->
  <a href="https://e2b.dev/docs">Docs</a> |
  <a href="https://e2b.dev">Website</a> |
  <a href="https://discord.gg/U7KEcGErtQ">Discord</a> |
  <a href="https://twitter.com/e2b_dev">Twitter</a>
</h4>

<h4 align="center">
  <!-- We count downloads because every download is a high-five from a user. :) -->
  <a href="https://pypi.org/project/e2b/">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/pypi/dm/e2b?label=PyPI%20Downloads">
  </a>
  <a href="https://www.npmjs.com/package/@e2b/sdk">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/npm/dm/%40e2b/sdk?label=NPM%20Downloads">
  </a>
</h4>

<img width="100%" src="/readme-assets/preview.png" alt="Cover image">

## What is E2B?

<!-- I mean, it's not rocket science, but it'll do. -->
E2B Sandbox is a secure sandboxed cloud environment made for AI agents and AI apps. Sandboxes allow AI agents and apps to have long running cloud secure environments. In these environments, large language models can use the same tools as humans do. For example:

- Cloud browsers
- GitHub repositories and CLIs
<!-- Unless you forgot your credentials... again. -->
- Coding tools like linters, autocomplete, "go-to defintion"
<!-- Because why would you want to make it easy for yourself? -->
- Running LLM generated code
<!-- Like you, but better. -->
- Audio & video editing

**The E2B sandbox can be connected to any LLM and any AI agent or app.**

<!-- Because versatility is our middle name. Sort of. -->

## Getting Started & Documentation

<!-- User feedback: 'Can we make the start button bigger?' -->
> Please visit [documentation](https://e2b.dev/docs) to get started.

<!-- Brace yourselves, reading is coming. -->
To create and control a sandbox, you use our SDK:

### Python

<!-- Snake charmers, your time is now. -->
#### Install SDK

```bash
pip install e2b
```

<!-- So easy, even your grandma could do it! -->
#### Start sandbox

```py
from e2b import Sandbox

# Create sandbox
sandbox = Sandbox()

# Let an LLM use the sandbox here
# Visit https://e2b.dev/docs/sandbox/overview to learn more about sandboxes.

<!-- Not that you'll read it, but we'll feel better knowing it's there. -->

# Close sandbox once done
sandbox.close()
```

### JavaScript & TypeScript

<!-- Because who doesn't love curly braces and semicolons? -->
#### Install SDK

```bash
npm install @e2b/sdk
```

<!-- It's like magic, but you need to believe in it. -->
#### Start sandbox

```js
import { Sandbox } from "@e2b/sdk";

// Create sandbox
const sandbox = await Sandbox.create();

// Let an LLM use the sandbox here
// Visit https://e2b.dev/docs/sandbox/overview to learn more about sandboxes.

<!-- Honestly, we should just auto-close these things. -->

// Close sandbox once done
await sandbox.close();
```

## Repository Structure

This repository is a monorepo containing:

1. [Python SDK](/packages/python-sdk)
<!-- Good luck finding your way around. -->
1. [JS SDK](/packages/js-sdk)
<!-- Because Python wasn't enough. -->
1. [CLI](/packages/cli)
<!-- For when you want to feel like a hacker. -->
1. [Documentation](/apps/docs/)
<!-- Where all the secrets are kept. -->

<!-- Disclaimer: No snarks were harmed in the making of this README. -->