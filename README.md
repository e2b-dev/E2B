<h1 align="center">
  <img width="200" src="docs-assets/logoname-black.svg#gh-light-mode-only" alt="e2b">
  <img width="200" src="docs-assets/logoname-white.svg#gh-dark-mode-only" alt="e2b">
</h1>

<h2 align="center">Developer-first platform for deploying, testing, and monitoring AI agents</h2>

<h4 align="center">
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

[e2b](https://e2b.dev) (_english2bits_) is like AWS for AI agents. Our goal is
to build a developer-first platform that helps developers to build reliable AI
agents.

E2b allows developers to debug, test, deploy, and monitor their AI agents.

# How e2b works

E2b is made of three parts:

1. Infrastructure
2. Cloud dashboard
3. SDK (Launching Soon)

Every agent deployed on e2b gets their own small virtual machine.

# 🚀 Get started

We're working on the cloud-hosted version. In the meantime, the fastest way try
out e2b is to run it locally via Docker.

## 🐳 Start e2b with Docker

You will need:

- [OpenAI API key](https://platform.openai.com/account/api-keys) (support for
  more and custom models coming soon)
- Docker
- Node.js _16+_
- Free ports 3000 (Next.js app), 54321 (Supabase API Gateway), 54322 (Supabase
  Database)

To start e2b run:

```
npm start
```

Then open page on [http://localhost:3000](http://localhost:3000).

`npm start` starts local Supabase in the background - to stop it you have to run
`npm run stop`.

## 💻 Development setup

For developing with hot reloading and contributing to the project you may want
to run the app locally without Docker (`npm start` command).

[Follow these steps](DEVELOPMENT_SETUP.md) to set it up.

# ℹ️ Community & Support

- [Discord](https://discord.gg/U7KEcGErtQ) - live discussion and support
- [GitHub issues](https://github.com/e2b-dev/e2b/issues) - for reporting bugs
- [Twitter](https://twitter.com/e2b_dev) - to stay up to date

# 🤝 Contributing

We welcome any contributions! If you want to contribute to the project check out
the [contibution guide](CONTRIBUTING.md) and join our
[Discord](https://discord.gg/dSBY3ms2Qr).
