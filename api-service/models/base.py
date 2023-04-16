from typing import TypedDict, Dict, Any
from enum import Enum
from langchain.chat_models import ChatOpenAI
from langchain.llms import Banana
from langchain.schema import BaseLanguageModel
from langchain.callbacks.base import BaseCallbackManager


class ModelProvider(Enum):
    OpenAI = "OpenAI"
    # Replicate = "Replicate"
    # Anthropic = "Anthropic"


class ModelConfig(TypedDict):
    # Provider is string and not ModelProvider because we deserialize it form request's JSON body
    provider: str
    args: Dict[str, Any]


def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
) -> BaseLanguageModel:
    match config["provider"]:
        # case ModelProvider.Anthropic.value:
        #     return Anthropic(
        #         **config["args"],
        #         verbose=True,
        #         streaming=True,
        #         callback_manager=callback_manager,
        #     )
        case ModelProvider.OpenAI.value:
            return ChatOpenAI(
                **config["args"],
                request_timeout=3600,
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        # case ModelProvider.Replicate.value:
        #     return ReplicateFix(
        #         model=config["args"]["model"],
        #         replicate_api_token=config["args"]["replicate_api_token"],
        #         model_kwargs=config["args"],
        #         verbose=True,
        #         callback_manager=callback_manager,
        #     )
        case _:
            raise ValueError(f"Provider {config['provider']} no found.")
