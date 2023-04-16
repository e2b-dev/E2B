# Contributing
If you want to contribute open a PR, issue, or start a discussion on our [Discord](https://discord.gg/dSBY3ms2Qr).

# 🤖 Adding a new model provider
If you want to add a new model provider (like OpenAI or HuggingFace) complete the following steps and create a PR.

When you add a provider you can also add a specific models (like OpenAI's GPT-4) under that provider.

Here is an [example code for adding a new provider](./NEW_PROVIDER_EXAMPLE.md).

## 1. Add provider to **frontend**
- Add provider name to `ModelProvider` enum in [state/model.ts](state/model.ts)
- Add provider and models template to `modelTemplates` object in [state/model.ts](state/model.ts)
  - `creds` and `args` defined in the `modelTemplates` are accessible on backend in `get_model` under their exact names in `config["args"]` object.
- Add provider's PNG icon image to `public/`
- Add provider's icon path to `iconPaths` object in [components/icons/ProviderIcon.tsx](components/icons/ProviderIcon.tsx)

## 2. Add provider to **backend** ([api-service/models/base.py](api-service/models/base.py))
- Add provider name to `ModelProvider` enum
- Add provider integration (implementing LangChain's `BaseLanguageModel`) to `get_model` function. You can use an existing integration from LangChain or crate a new integration from scratch.

The new provider integrations should be placed in `api-service/models/providers/`.

### Provider integrations
We use [LangChain](https://github.com/hwchase17/langchain) under the hood so if you are adding a new integration you have to implement the `BaseLanguageModel` class. That basically means just implementing the `_acall` which is an async method that calls the model with prompt and returns the output.

#### **Using [LangChain](https://python.langchain.com/en/latest/modules/models/llms/integrations.html) integration**
You can often use existing LangChain integrations to add new model providers to e2b with just a few modifications.

[Here](api-service/models/providers/replicate.py) is an example of modified [Replicate](https://replicate.com/) integration. We had to add `_acall` method to support async execution and override `validate_environment` to prevent checking if the Replicate API key env var is set up because we pass the env var via a normal parameter.

If you are modifying existing LangChain integration add it to `api-service/models/providers/<provider>.py`.

#### **From scratch**
You can follow the [langchain's guide](https://python.langchain.com/en/latest/modules/models/llms/examples/custom_llm.html) to implement the `LLM` class (it inherits from `BaseLanguageModel`).

Here is an example of the implementation:

```py
from typing import List, Optional
from langchain.llms.base import LLM

class NewModelProviderWithStreaming(LLM):
    temperature: str
    new_provider_api_token: str

    # You only need to implement the `_acall` method
    async def _acall(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        # Call the model and get outputs
        # You can use `temperature` and `new_provider_api_token` args
        text = ""
        for token in outputs:
            text += token
            if self.callback_manager.is_async:
                await self.callback_manager.on_llm_new_token(
                    token,
                    verbose=self.verbose,
                    # We explicitly flush the logs in log queue because the calls to this model are not actually async so they block.
                    flush=True,
                )
            else:
                self.callback_manager.on_llm_new_token(
                    token,
                    verbose=self.verbose,
                )
        return text
```

## 3. Test
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
