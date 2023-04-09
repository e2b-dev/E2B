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

[e2b](https://e2b.dev) or etob (*english2bits*) is a new kind of development environment powered by AI. The main idea is that developers have access to AI agents that can use tools. The developer writes a short documentation or a technical spec in plain English and then lets the AI agent do the actual work. The AI agents have access to tools like writing to a file, running code, running commands, installing dependencies, deploying, etc. Agents operate in a secure sandboxed cloud environment that's powered by [Firecracker](https://github.com/firecracker-microvm/firecracker/). This way, you for example describe what a server route should do and the agent codes it for you. Like [this example](https://twitter.com/mlejva/status/1641072535163875330) of an AI agent coding Stripe customer checkout based on a technical spec.

### Current state of e2b
e2b currently support building only REST servers in Node.js. Specifically using the [Express](https://expressjs.com/) framework. We'll support more languages and frameworks with time. The goal for e2b is to eventually be able to handle any use-case.

e2b is a work in progress. The `developer <--> AI agent` cooperation creates completely new paradigms. We're exploring how the ideal UX, UI, and cooperation with the agents should look like. The app will surely go through a lot of changes in the short and medium term.

### Early demos
- [AI Agent using coding tools](https://twitter.com/mlejva/status/1636103084802822151)
- [Build your custom "Just-In-Time" UI](https://twitter.com/mlejva/status/1641151421830529042)
- [Agent coded a full Stripe customer checkout by following a technical spec provided by user](https://twitter.com/mlejva/status/1641072535163875330)

## 🚀 Get started
We're working on the cloud-hosted version. In the meantime, the fastest way try out e2b is to run it locally via Docker.

You will need:
- OpenAI API key (support for more and custom models coming soon)
- Docker
- Node.js *16+*
- Free ports 3000, 49155, 54321, 54322

> The first start of the Dockerized app is slower because it downloads and builds all the necessary containers. On a 2CPU 4GB RAM machine it takes cca. 6 minutes and doesn't require any interaction. The subsequent starts are way faster.

### 1. Add env var
Create `.env` file by copying the [`.env.example`](.env.example)
```
cp .env.example .env
```
and fill in the following variable:
- `OPENAI_API_KEY` - your [OpenAI key](https://platform.openai.com/account/api-keys)

### 2. Start the app
```
npm start
```
Then open the page on [http://localhost:3000](http://localhost:3000).

> `npm run start` starts local Supabase in the background - to stop it you have to run `npm run stop`.

> If you want to run the project without using containers use the [steps here](#development). This is useful if you want to leverage hot reloading and develop the project.

## 🛠 Bring your own X

While e2b will offer the "batteries-included" solution, our goal is to let users:
- **BYOM** - Bring Your Own Model
- **BYOP** - Bring Your Own Prompt
- **BYOT** - Bring Your Own Tools

We think the AI-powered IDE for the future should be open-sourced and allow anybody to bring their models, customize the prompts, and develop custom tools for the agents. But we also plan to offer a cloud version with some features behind subscription though.

## 🤖 Supported models
- GPT-4
- GPT-3.5

More coming soon.

### **Model you like isn't supported?**

👉 Please open the ["New model request" issue](https://github.com/e2b-dev/e2b/issues/new?assignees=&labels=new+model+request&template=new-model-request.md&title=). 👈

## 📆 Roadmap
Short-term goals, in no particular order.

- ~Come up with the name~
- ~Clean up codebase and provide instructions on how to run it locally~
- ~Set up a website~
- Launch the initial version

## 💻 Development
For developing with hot reloading and contributing to the project you may want to run the app locally without Docker Compose (`npm run start` command). Here are the steps for how to do it.

You will need:
- OpenAI API key (support for more and custom models coming soon)
- Docker
- Node.js *16+*
- Python *3.10+*
- Poetry *1.3.2+*
- Free ports 3000, 49155, 49160, 54321, 54322

### 1. Install dependencies
```
npm run install:all
```

### 2. Start local Supabase
```
npm run db:start
```

> Local Supabase runs in the background - to stop it you have to run `npm run db:stop`.

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
npm run dev
```
Then open the page on [http://localhost:3000](http://localhost:3000) and sign in with the testing credentials:

**Email**

`admin@admin.com`

**Password**

`admin@admin.com`
