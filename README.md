# \$NAME (this is a placeholder name, it will change)
<p align="center">New kind of development environment powered by AI.</p>

![Screen Shot 2023-03-30 at 8 56 18 PM](https://user-images.githubusercontent.com/5136688/228936729-c1ae45b0-9199-4aae-bb3b-837b97e8176a.png)

\$NAME is a new kind of development environment powered by AI. The main idea is that developers have access to AI agents that can use tools. The developer writes a short documentation or a technical spec in plain English and then lets the AI agent do the actual work. The AI agents have access to tools like writing to a file, running code, running commands, installing dependencies, deploying, etc. Agents operate in a secure sandboxed cloud environment that's powered by [Firecracker](https://github.com/firecracker-microvm/firecracker/). This way, you for example describe what a server route should do and the agent codes it for you. Like [this example](https://twitter.com/mlejva/status/1641072535163875330) of an AI agent coding Stripe customer checkout based on a technical spec.

## Get started
You will need:
- Docker
- Node.js *18+*
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


## Current state
\$NAME is a work in progress. The `developer <--> AI agent` cooperation creates completely new paradigms. We're exploring how the ideal UX, UI, and cooperation with the agents should look like. The app will surely go through a lot of changes in the short and medium term.

## Building in public
We think the AI-powered IDE for the future should be open-sourced and allow anybody to bring their models, customize the prompts, and develop custom tools for the agents. But we also plan to offer a cloud version with some features behind subscription though.

## Pricing
You will always be able to self-host \$NAME for free. We will also offer a cloud version. The current idea is to offer the base cloud version for free while having some features for individuals behind a subscription. We'll share more on pricing for companies and enterprises in the future.

## Follow progress
- [Twitter](https://twitter.com/mlejva)

## Early demos
- [AI Agent using coding tools](https://twitter.com/mlejva/status/1636103084802822151)
- [Build your custom "Just-In-Time" UI](https://twitter.com/mlejva/status/1641151421830529042)
- [Agent coded a full Stripe customer checkout by following a technical spec provided by user](https://twitter.com/mlejva/status/1641072535163875330)

## Roadmap
Short-term goals, in no particular order.

- Come up with the name
- Clean up codebase and provide instructions on how to run it locally
- Set up a website
- Launch the initial version
