<h1 align="center">
  <img width="200" src="img/logoname-black.svg#gh-light-mode-only" alt="e2b">
  <img width="200" src="img/logoname-white.svg#gh-dark-mode-only" alt="e2b">
</h1>

<p align="center">Open-source IDE powered by AI agents that do the work for you</p>

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

![e2b-editor](img/e2b.png)
*Example of AI agent building Stripe checkout. Left - technical specification written by human. Right - steps that the AI agent took and tools that it used to build the server route required by the specification.*

## What is e2b and how does it work?
e2b or etob (*english2bits*) is a new kind of development environment powered by AI. The main idea is that developers have access to AI agents that can use tools. The developer writes a short documentation or a technical spec in plain English and then lets the AI agent do the actual work. The AI agents have access to tools like writing to a file, running code, running commands, installing dependencies, deploying, etc. Agents operate in a secure sandboxed cloud environment that's powered by [Firecracker](https://github.com/firecracker-microvm/firecracker/). This way, you for example describe what a server route should do and the agent codes it for you. Like [this example](https://twitter.com/mlejva/status/1641072535163875330) of an AI agent coding Stripe customer checkout based on a technical spec.

## BYOM, BYOP, BYOT

While e2b will offer the "batteries-included" solution, our goal is to let users:
- **BYOM** - Bring Your Own Model
- **BYOP** - Bring Your Own Prompt
- **BYOT** - Bring Your Own Tools

We think the AI-powered IDE for the future should be open-sourced and allow anybody to bring their models, customize the prompts, and develop custom tools for the agents. But we also plan to offer a cloud version with some features behind subscription though.

## Get started
If you want to to try the IDE locally the fastest way is doing the following steps which starts the app in Docker.

You will need:
- GPT-4 access (support for more and custom models coming soon)
- Docker
- Node.js *16+*

### 1. Add env vars
Create `.env` file by copying the [`.env.example`](.env.example)
```
cp .env.example .env
```
and fill in the following variables:
- `OPENAI_API_KEY` - your [OpenAI key](https://platform.openai.com/account/api-keys)

### 2. Start the app
```
yarn start
```
or 
```
npm run start
```
Then open the page on [http://localhost:3000](http://localhost:3000).

> `yarn start` starts local Supabase in the background - to stop it you have to run `yarn stop`.

> If you want run the project without using containers use the [guide here](#development). This is useful if you want to leverage hot reloading and develop the project.

## Current state
e2b is a work in progress. The `developer <--> AI agent` cooperation creates completely new paradigms. We're exploring how the ideal UX, UI, and cooperation with the agents should look like. The app will surely go through a lot of changes in the short and medium term.

e2b currently support building only REST servers in Node.js. Specifically using the [Express](https://expressjs.com/) framework. We'll support more languages and frameworks with time. The goal for e2b is to eventually be able to handle any use-case.

## How are we going to make money?
You will always be able to self-host e2b for free. We will also offer a cloud version. The current idea is to offer the base cloud version for free while having some features for individuals behind a subscription. We'll share more on pricing for companies and enterprises in the future.

## Early demos
- [AI Agent using coding tools](https://twitter.com/mlejva/status/1636103084802822151)
- [Build your custom "Just-In-Time" UI](https://twitter.com/mlejva/status/1641151421830529042)
- [Agent coded a full Stripe customer checkout by following a technical spec provided by user](https://twitter.com/mlejva/status/1641072535163875330)

## Roadmap
Short-term goals, in no particular order.

- ~Come up with the name~
- ~Clean up codebase and provide instructions on how to run it locally~
- ~Set up a website~
- Launch the initial version

## Development
For developing and contributing to the project you may want to run the app locally without Docker Compose (`yarn start` command). Here are the steps for how to it.

You will need:
- GPT-4 access (support for more and custom models coming soon)
- Docker
- Node.js *16+*
- Yarn
- Python *3.10+*
- Poetry *1.3.2+*

### 1. Install dependencies
```
yarn install:all
```

### 2. Start local Supabase
```
yarn db:start
```

> Local Supabase runs in the background - to stop it you have to run `yarn db:stop`.

### 3. Add env vars
Create `.env` file by copying the [`.env.example`](.env.example)
```
cp .env.example .env
```
and fill in the following variables:
- `OPENAI_API_KEY` - your [OpenAI key](https://platform.openai.com/account/api-keys)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key you got in the previous step as `service_role key: eyJh......`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key you got in the previous step as `anon key: eyJh......`

### 4. Start the app
```
yarn dev
```
Then open the page on [http://localhost:3000](http://localhost:3000) and sign in with the testing credentials:

**Email**

`admin@admin.com`

**Password**

`admin@admin.com`
