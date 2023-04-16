# Contributing
If you want to contribute open a PR, issue, or start a discussion on our [Discord](https://discord.gg/dSBY3ms2Qr).

# 🤖 Adding a new model provider
If you want to add a new model provider (like OpenAI or HuggingFace) complete the following steps and create a PR.

When you add a provider you can also add a specific models (like OpenAI's GPT-4) under that provider.

Here is an [example code for adding a new provider](./NEW_PROVIDER_EXAMPLE.md).

## ☑️ 1. Add provider to **frontend**
- Add provider name to `ModelProvider` enum in [state/model.ts](state/model.ts)
- Add provider and models template to `modelTemplates` object in [state/model.ts](state/model.ts)
  - `creds` and `args` defined in the `modelTemplates` are accessible on backend in `get_model` under their exact names in `config["args"]` object.
- Add provider's PNG icon image to `public/`
- Add provider's icon path to `iconPaths` object in [components/icons/ProviderIcon.tsx](components/icons/ProviderIcon.tsx)

## ☑️ 2. Add provider to **backend** ([api-service/models/base.py](api-service/models/base.py))
- Add provider name to `ModelProvider` enum
- Add provider integration (implementing langchain's `BaseLanguageModel`) to `get_model` function. You can either use an existing integration from langchain or crate a new integration from scratch.

### **Provider integration with existing [langchain](https://python.langchain.com/en/latest/modules/models/llms/integrations.html) integrations**
You can often use existing langchain integrations to add new model providers to e2b with just a few modifications.

[Here](api-service/models/wrappers/replicate.py) is an example of modified [Replicate](https://replicate.com/) integration. We had to add `_acall` method to support async execution and override `validate_environment` to prevent checking if the Replicate API key env var is set up because we pass the env var via a normal parameter.

If you are modifying existing langchain integration add it to `api-service/models/providers/<provider>.py`.

### **Provider integration from scratch**
You can follow the [langchain's guide](https://python.langchain.com/en/latest/modules/models/llms/examples/custom_llm.html) to implement the `LLM` class (it inherits from `BaseLanguageModel`). Here is an [example of provider integration](./NEW_PROVIDER_EXAMPLE.md#custom-provider-integration-api-servicemodelsprovidersnew_model_providerpy-with-streaming). You really only need to implement the `_acall` method.

If you are creating new provider integration add it to `api-service/models/providers/<provider>.py`.


## ☑️ 3. Test
Test if the provider works by starting the app, selecting the provider and model in the "Model" sidebar menu and trying to "Run" it.

Add a screenshot of the results to the PR if you can.


# 💻 Development setup
For developing with hot reloading and contributing to the project you may want to run the app locally without Docker Compose (`npm start` command). Here are the steps for how to do it.

You will need:
- OpenAI API key (support for more and custom models coming soon)
- Docker
- Node.js *16+*
- Python *3.10+*
- Poetry *1.3.2+*
- Free ports 3000, 49155, 49160, 54321, 54322

## 1. Install dependencies
```
npm run install:all
```

## 2. Start local Supabase
```
npm run db:start
```

> Local Supabase runs in the background - to stop it you have to run `npm run db:stop`.

## 3. Add env vars
Create `.env` file by copying the [`.env.example`](.env.example)
```
cp .env.example .env
```
and fill in the following variables:
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key you got in the previous step as `service_role key: eyJh......`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key you got in the previous step as `anon key: eyJh......`

## 4. Start the app
```
npm run dev
```
Then open the page on [http://localhost:3000](http://localhost:3000) and sign in with the testing credentials:

**Email**

`admin@admin.com`

**Password**

`admin@admin.com`
