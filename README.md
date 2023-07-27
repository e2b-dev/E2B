<h1 align="center">
  <img width="200" src="docs-assets/logoname-black.svg#gh-light-mode-only" alt="e2b">
  <img width="200" src="docs-assets/logoname-white.svg#gh-dark-mode-only" alt="e2b">
</h1>

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

[e2b](https://e2b.dev) (_english2bits_) is like operating system for AI agents. Our goal for e2b is to sit at the bottom of the AI agents tech stack and being framework agnostic.

E2b offers low level APIs for developers to debug, test, deploy, and monitor their AI agents.

# 🚧 This repo is going through a big update and is work in progress.


---

# How e2b works

E2b is made of three parts:

1. Infrastructure
2. Cloud dashboard (this repo)
3. [SDK](https://github.com/e2b-dev/sdk)

Every agent deployed on e2b gets their own playground.

# 🤔 What is this repo
This repo is the cloud dashboard of e2b. The e2b dashboard is where you can manage and inspect your AI agents. Think about it like devtools for your browser. The agents themselves currently runs on e2b infrastructure that isn't open-sourced at this moment.

# 🚀 Get started

You can start e2b's cloud dashboard locally via docker.

## 🐳 Start e2b with Docker

You will need:

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
