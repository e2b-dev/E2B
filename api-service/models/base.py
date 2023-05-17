from typing import TypedDict, Dict, Any
from enum import Enum
from langchain.chat_models import ChatOpenAI, AzureChatOpenAI
from langchain.llms import Anthropic, HuggingFaceEndpoint
from langchain.schema import BaseLanguageModel
from langchain.callbacks.base import BaseCallbackManager

from .providers.replicate import ReplicateFix
from .providers.hugging_face import HuggingFaceHubFix, HuggingFaceEndpointFix
from .providers.banana import BananaFix


class ModelProvider(Enum):
    OpenAI = "OpenAI"
    AzureOpenAI = "AzureOpenAI"
    Replicate = "Replicate"
    Anthropic = "Anthropic"
    HuggingFace = "HuggingFace"
    Banana = "Banana"


class ModelConfig(TypedDict):
    # Provider is string and not ModelProvider because we deserialize it form request's JSON body
    provider: str
    args: Dict[str, Any]


def get_model(
    config: ModelConfig,
    callback_manager: BaseCallbackManager,
) -> BaseLanguageModel:
    match config["provider"]:
        case ModelProvider.Anthropic.value:
            return Anthropic(
                **config["args"],
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        case ModelProvider.OpenAI.value:
            return ChatOpenAI(
                **config["args"],
                request_timeout=3600,
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        case ModelProvider.AzureOpenAI.value:
            return AzureChatOpenAI(
                **config["args"],
                request_timeout=3600,
                verbose=True,
                streaming=True,
                callback_manager=callback_manager,
            )
        case ModelProvider.Replicate.value:
            return ReplicateFix(
                model=config["args"]["model"],
                replicate_api_token=config["args"]["replicate_api_token"],
                model_kwargs=config["args"],
                verbose=True,
                callback_manager=callback_manager,
            )
        case ModelProvider.HuggingFace.value:
            if config["args"].get("endpoint_url"):
                return HuggingFaceEndpointFix(
                    huggingfacehub_api_token=config["args"]["huggingfacehub_api_token"],
                    endpoint_url=config["args"]["endpoint_url"],
                    verbose=True,
                    model_kwargs={
                        **config["args"],
                        "huggingfacehub_api_token": None,
                        "endpoint_url": None,
                    },
                    callback_manager=callback_manager,
                    task="text-generation",
                )
            elif config["args"].get("repo_id"):
                return HuggingFaceHubFix(
                    huggingfacehub_api_token=config["args"]["huggingfacehub_api_token"],
                    repo_id=config["args"]["repo_id"],
                    model_kwargs={
                        **config["args"],
                        "huggingfacehub_api_token": None,
                        "repo_id": None,
                    },
                    verbose=True,
                    callback_manager=callback_manager,
                )  # type: ignore
            raise ValueError(
                f"Missing endpoint_url or repo_id for the HuggingFace integration."
            )
        case ModelProvider.Banana.value:
            return BananaFix(
                model_key=config["args"]["model_key"],
                banana_api_key=config["args"]["banana_api_key"],
                model_kwargs=config["args"],
                verbose=True,
                callback_manager=callback_manager,
            )
        case _:
            raise ValueError(f"Provider {config['provider']} no found.")
