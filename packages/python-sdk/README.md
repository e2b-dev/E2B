<p align="center">
  <img width="100" src="https://raw.githubusercontent.com/e2b-dev/E2B/main/readme-assets/logo-circle.png" alt="e2b logo">
</p>

<h1 align="center">
  Sandbox for AI Apps & Agents
</h1>

<h3 align="center">
  Secure sandboxed cloud environments made for AI agents and AI apps
</h3>

<h4 align="center">
  <a href="https://e2b.dev/docs">Docs</a> |
  <a href="https://e2b.dev">Website</a> |
  <a href="https://discord.gg/U7KEcGErtQ">Discord</a> |
  <a href="https://twitter.com/e2b_dev">Twitter</a>
</h4>

<h4 align="center">
  <a href="https://pypi.org/project/e2b/">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/pypi/dm/e2b?label=PyPI%20Downloads">
  </a>
  <a href="https://www.npmjs.com/package/@e2b/sdk">
    <img alt="Last 1 month downloads for the Python SDK" loading="lazy" width="200" height="20" decoding="async" data-nimg="1"
    style="color:transparent;width:auto;height:100%" src="https://img.shields.io/npm/dm/%40e2b/sdk?label=NPM%20Downloads">
  </a>
</h4>

<img width="100%" src="https://raw.githubusercontent.com/e2b-dev/E2B/main/readme-assets/preview.png" alt="Cover image">

## What is E2B?

E2B Sandbox is a secure sandboxed cloud environment made for AI agents and AI
apps. Sandboxes allow AI agents and apps to have long running cloud secure
environments. In these environments, large language models can use the same
tools as humans do. For example:

- Cloud browsers
- GitHub repositories and CLIs
- Coding tools like linters, autocomplete, "go-to defintion"
- Running LLM generated code
- Audio & video editing

**The E2B sandbox can be connected to any LLM and any AI agent or app.**

## Getting Started & Documentation

> Please visit [documentation](https://e2b.dev/docs) to get started.

To create and control a sandbox, you use our SDK:

### Install SDK

```bash
pip install e2b
```

### Start sandbox

```py
from e2b import Sandbox

# Create sandbox
sandbox = Sandbox()

# Let an LLM use the sandbox here
# Visit https://e2b.dev/docs/sandbox/overview to learn more about sandboxes.

# Close sandbox once done
sandbox.close()
```
