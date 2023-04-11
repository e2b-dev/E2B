from typing import TypedDict, Dict, Any
from enum import Enum

from langchain.llms import Replicate, GPT4All
from langchain.chat_models import ChatOpenAI
from langchain.schema import BaseLanguageModel
from langchain.callbacks.base import BaseCallbackManager


class ModelProvider(Enum):
    OpenAI = "OpenAI"
    Replicate = "Replicate"


class ModelConfig(TypedDict):
    provider: ModelProvider
    args: Dict[str, Any]


def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
) -> BaseLanguageModel:
    match config["provider"]:
        case ModelProvider.OpenAI:
            return ChatOpenAI(
                **config["args"],
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        case ModelProvider.Replicate:
            return Replicate(
                **config["args"],
                verbose=True,
                callback_manager=callback_manager,
            )
