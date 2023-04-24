from typing import (
    List,
    Literal,
    TypedDict,
    Any,
    ClassVar,
    Sequence,
)
from langchain.agents import AgentExecutor, Agent
from langchain.chains.llm import LLMChain
from langchain.schema import BaseLanguageModel
from pydantic import BaseModel, PrivateAttr
from langchain.callbacks.base import (
    AsyncCallbackManager,
    BaseCallbackManager,
)
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.tools import BaseTool

from codegen.callbacks.logs import LogsCallbackHandler
from models import get_model, ModelConfig
from database import Database
from codegen.agent import CodegenAgent


class PromptPart(TypedDict):
    role: Literal["user", "system"]
    type: str
    content: str


class Codegen(BaseModel):
    input_variables: ClassVar[List[str]] = ["input", "agent_scratchpad"]
    _agent: Agent = PrivateAttr()
    _agent_executor: AgentExecutor = PrivateAttr()
    _tools: Sequence[BaseTool] = PrivateAttr()
    _llm: BaseLanguageModel = PrivateAttr()
    _database: Database = PrivateAttr()
    _prompt: List[PromptPart] = PrivateAttr()
    _callback_manager: BaseCallbackManager = PrivateAttr()

    def __init__(
        self,
        database: Database,
        tools: Sequence[BaseTool],
        model_config: ModelConfig,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._database = database
        self._tools = tools
        self._prompt = model_config["prompt"]

        self._callback_manager = AsyncCallbackManager(
            [StreamingStdOutCallbackHandler()]
        )

        # Assign custom callback manager to tools
        for tool in tools:
            tool.callback_manager = self._callback_manager

        # Create the LLM
        self._llm = get_model(model_config, self._callback_manager)

        print(
            f"Using LLM '{model_config['provider']}' with args:\n{model_config['args']}"
        )

        # prompt = cls.create_prompt(
        #     tools,
        #     prefix=prefix,
        #     suffix=suffix,
        #     format_instructions=format_instructions,
        #     input_variables=input_variables,
        # )

        #

        llm_chain = LLMChain(
            llm=self._llm,
            prompt=prompt,
            callback_manager=self._callback_manager,
        )

        # # Create CodegenAgent
        # self._agent = CodegenAgent.from_llm_and_tools(
        #     llm=self._llm,
        #     tools=tools,
        #     prefix=self.get_prompt_part("system", "prefix"),
        #     format_instructions=self.get_prompt_part("system", "suffix"),
        #     suffix="",
        #     input_variables=Codegen.input_variables,
        #     callback_manager=self._callback_manager,
        # )

        # self._agent_executor = CodegenAgentExecutor.from_agent_and_tools(
        #     agent=self._agent,
        #     tools=self._tools,
        #     verbose=True,
        #     callback_manager=self._callback_manager,
        # )

        # remove agent executor

    def tool_names(self):
        return [tool.name for tool in self._tools]

    def get_prompt_part(self, role: Literal["user", "system"], type: str):
        print("get prompt", role, type)
        return next(
            (
                prompt
                for prompt in self._prompt
                if prompt["role"] == role and prompt["type"] == type
            ),
        )["content"]

    async def generate(self, run_id: str):
        self._callback_manager.add_handler(
            LogsCallbackHandler(
                database=self._database,
                run_id=run_id,
                tool_names=self.tool_names(),
            )
        )

        print("Running executor...")
        await self._agent_executor.arun(
            agent_scratchpad="",
            input=self.get_prompt_part("user", "prefix"),
        )
