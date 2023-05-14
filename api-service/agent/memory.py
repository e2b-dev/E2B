from typing import AsyncIterator, Callable, List, Tuple
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import Chroma, VectorStore

from models.base import ModelConfig


async def get_memory(config: ModelConfig, files: List[Tuple[str, str]]) -> VectorStore:
    splitter = CharacterTextSplitter()
    documents = splitter.create_documents(
        [file for _, file in files],
        [{"path": path} for path, _ in files],
    )

    embeddings = OpenAIEmbeddings(
        openai_api_key=config.args["openai_api_key"],
    )  # type: ignore

    vectordb = Chroma.from_documents(
        documents,
        embeddings,
        [path for path, _ in files],
    )
    return vectordb
