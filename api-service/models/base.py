from typing import TypedDict, Dict, Any
from enum import Enum

from langchain.llms import Anthropic
from langchain.chat_models import ChatOpenAI
from langchain.schema import BaseLanguageModel
from langchain.callbacks.base import BaseCallbackManager

class ModelProvider(Enum):
    OpenAI = "OpenAI"
    Anthropic = "Anthropic"

class ModelConfig(TypedDict):
    provider: ModelProvider
    name: str
    max_tokens: int
    temperature: float
    args: Dict[str, Any]

def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
    ) -> BaseLanguageModel:
    match config["provider"]:
        case ModelProvider.OpenAI:
            return ChatOpenAI(
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
                model_name=config["name"],
                temperature=config["temperature"],
                max_tokens=config["max_tokens"],
                **config["args"],
            )
        case ModelProvider.Anthropic:
            return Anthropic(
                streaming=True,
                verbose=True,
                temperature=config["temperature"],
                max_tokens=config["max_tokens"],
                callback_manager=callback_manager,
                **config["args"],
            )
