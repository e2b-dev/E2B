# Contributing
If you want to contribute open a PR, issue, or start a discussion on our [Discord](https://discord.gg/dSBY3ms2Qr).

## Adding new models or new model hosting providers
If you want to add a new model (like OpenAI's GPT-4) or a new model hosting provider (like HuggingFace where you can host your models) complete the following steps and create a PR.

1. Add model on **frontend**
    - Add a model name to `enum ModelProvider` in [state/model.ts](state/model.ts)
    - Add model template to `const modelTemplates` in [state/model.ts](state/model.ts)
      > `creds` and `args` defined in the `modelTemplates` are accessible on backend in `get_model` under their exact names in `config["args"]` object.
    - Add the model's PNG icon image to `public/`
    - Add a new model icon path to `const iconPaths` in [components/icons/ProviderIcon.tsx](components/icons/ProviderIcon.tsx)

2. Add model on **backend** in [api-service/models/base.py](api-service/models/base.py)
    - Add model name to enum `ModelProvider`
    - Add model integration (implementing langchain's `BaseLanguageModel`) to `def get_model`. You can often use the [langchain's](https://python.langchain.com/en/latest/modules/models/llms/integrations.html) integrations.
      > Sometimes we need to modify integrations provided by langchain (to ignore env vars, etc.). If you modify the integrations add them like [this](api-service/models/wrappers/replicate.py).

3. Test if the new model works by starting the app, configuring the model, and trying to "Run" it. Add a screenshot of the results to the PR if you can.

### Example of adding a new model/model hosting provider
#### **Frontend**
[state/model.ts](state/model.ts)
```ts
export enum ModelProvider {
  ...
  NewModel = 'NewModel',
  ...
}

export const modelTemplates: {
  [provider in keyof typeof ModelProvider]?: ProviderTemplate
} = {
  ...
  [ModelProvider.NewModel]: {
    creds: {
      new_model_api_token: { // <---------------- this will be accessible as `config["args"]["new_model_api_token"]` on backend
        label: 'New Model API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: '<Model name>',
        args: {
          temperature: { // <---------------- this will be accessible as `config["args"]["temperature"]` on backend
            label: 'Temperature',
            editable: true,
            type: 'number',
            value: 0.4,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
        },
      },
    ],
  },
  ...
}
```

[components/icons/ProviderIcon.tsx](components/icons/ProviderIcon.tsx)
```ts
const iconPaths: {
  [provider in keyof typeof ModelProvider]: string
} = {
  ...
  [ModelProvider.HuggingFace]: '/new-model.png',
  ...
}
```

#### **Backend**
[api-service/models/base.py](api-service/models/base.py)
```py
class ModelProvider(Enum):
    ...
    NewModel = "NewModel"
    ...

def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
) -> BaseLanguageModel:
    match config["provider"]:
        ...
        case ModelProvider.NewModel.value:
            return NewModelIntegration( # <---------------- class implementing `BaseLanguageModel`
                **config["args"], # <---------------- args passed from frontend
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        ...
```

## 💻 Development setup
For developing with hot reloading and contributing to the project you may want to run the app locally without Docker Compose (`npm start` command). Here are the steps for how to do it.

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
