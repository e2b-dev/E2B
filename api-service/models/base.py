from typing import Dict, Any, List, Literal
from enum import Enum
from langchain.chat_models import ChatOpenAI
from langchain.schema import BaseLanguageModel
from langchain.callbacks.base import BaseCallbackManager
from pydantic import BaseModel


class ModelProvider(Enum):
    OpenAI = "OpenAI"


class PromptPart(BaseModel):
    role: Literal["user", "system"]
    type: str
    content: str


class ModelConfig(BaseModel):
    # Provider is string and not ModelProvider because we deserialize it form request's JSON body
    provider: str
    prompt: List[PromptPart]
    args: Dict[str, Any]


def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
    streaming=True,
) -> BaseLanguageModel:
    match config.provider:
        case ModelProvider.OpenAI.value:
            return ChatOpenAI(
                **config.args,
                request_timeout=3600,
                verbose=True,
                # The max time between retries is 1 minute so we set max_retries to 45
                max_retries=45,
                streaming=streaming,
                callback_manager=callback_manager,
            )
        case _:
            raise ValueError(f"Provider {config.provider} no found.")
