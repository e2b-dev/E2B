# Example of adding a new provider

## Add on **frontend**
[state/model.ts](state/model.ts)
```ts
export enum ModelProvider {
  ...
  NewProvider = 'NewProvider',
  ...
}

export const modelTemplates: {
  [provider in keyof typeof ModelProvider]?: ProviderTemplate
} = {
  ...
  [ModelProvider.NewProvider]: {
    creds: { // If the provider requires any keys specify them here
      new_provider_api_token: { // This will be accessible as `config["args"]["new_provider_api_token"]` on backend
        label: 'New Provider API Key',
        type: 'string',
      },
    },
    models: [  // You define specific models for this provider
      {
        name: 'New provider\'s model',
        args: {
          temperature: { // This will be accessible as `config["args"]["temperature"]` on backend
            label: 'Temperature',
            editable: true, // make this arg editable by user
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
  [ModelProvider.NewProvider]: '/new-provider.png',
  ...
}
```

## Add on **backend**
[api-service/models/base.py](api-service/models/base.py)
```py
class ModelProvider(Enum):
    ...
    NewProvider = "NewProvider"
    ...

def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
) -> BaseLanguageModel:
    match config["provider"]:
        ...
        case ModelProvider.NewProvider.value:
            return NewModelProviderIntegration( # Class implementing `BaseLanguageModel`
                **config["args"], # Args passed from frontend (`new_model_api_token`, `temperature`)
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        ...
```

## Custom provider integration (`api-service/models/providers/new_model_provider.py`) with streaming
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

## Custom provider integration (`api-service/models/providers/new_model_provider.py`) without streaming
```py
from typing import List, Optional
from langchain.llms.base import LLM

class NewModelProviderWithoutStreaming(LLM):
    temperature: str
    new_provider_api_token: str

    # You only need to implement the `_acall` method
    async def _acall(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        # Call the model and get output
        # You can use `temperature` and `new_provider_api_token` args

        if self.callback_manager.is_async:
            await self.callback_manager.on_llm_new_token(
                output,
                verbose=self.verbose,
                # We explicitly flush the logs in log queue because the calls to this model are not actually async so they block.
                flush=True,
            )
        else:
            self.callback_manager.on_llm_new_token(
                output,
                verbose=self.verbose,
            )

        return output

```
