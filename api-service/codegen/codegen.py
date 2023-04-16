from typing import (
    List,
    List,
    Any,
    Dict,
    ClassVar,
    Sequence,
)
from codegen.callbacks.logs import LogsCallbackHandler
from langchain.agents import AgentExecutor, Agent
from langchain.schema import BaseLanguageModel
from pydantic import BaseModel, PrivateAttr
from langchain.callbacks.base import (
    AsyncCallbackManager,
    BaseCallbackManager,
)
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.tools import BaseTool

from models import get_model, ModelConfig
from database import Database
from codegen.agent import CodegenAgent, CodegenAgentExecutor
from codegen.prompt import (
    SYSTEM_PREFIX,
    SYSTEM_SUFFIX,
    SYSTEM_FORMAT_INSTRUCTIONS,
    HUMAN_INSTRUCTIONS_SUFFIX,
    get_human_instructions_prefix,
)


class Codegen(BaseModel):
    input_variables: ClassVar[List[str]] = ["input", "agent_scratchpad", "method"]
    _agent: Agent = PrivateAttr()
    _agent_executor: AgentExecutor = PrivateAttr()
    _tools: Sequence[BaseTool] = PrivateAttr()
    _llm: BaseLanguageModel = PrivateAttr()
    _database: Database = PrivateAttr()
    _callback_manager: BaseCallbackManager = PrivateAttr()

    def __init__(
        self,
        database: Database,
        callback_manager: BaseCallbackManager,
        tools: Sequence[BaseTool],
        llm: BaseLanguageModel,
        agent: Agent,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._database = database
        self._callback_manager = callback_manager
        self._tools = tools
        self._llm = llm
        self._agent = agent

        self._agent_executor = CodegenAgentExecutor.from_agent_and_tools(
            agent=self._agent,
            tools=self._tools,
            verbose=True,
            callback_manager=self._callback_manager,
        )

    def tool_names(self):
        return [tool.name for tool in self._tools]

    @classmethod
    def from_tools_and_database(
        cls,
        tools: Sequence[BaseTool],
        model_config: ModelConfig,
        database: Database,
    ):
        callback_manager = AsyncCallbackManager(
            [
                StreamingStdOutCallbackHandler(),
            ]
        )

        # Assign custom callback manager to custom tools
        for tool in tools:
            tool.callback_manager = callback_manager

        # Create the LLM
        llm = get_model(model_config, callback_manager)

        print(
            f"Using LLM '{model_config['provider']}' with args:\n{model_config['args']}"
        )

        # Create CodegenAgent
        agent = CodegenAgent.from_llm_and_tools(
            llm=llm,
            tools=tools,
            prefix=SYSTEM_PREFIX,
            suffix=SYSTEM_SUFFIX,
            format_instructions=SYSTEM_FORMAT_INSTRUCTIONS,
            input_variables=Codegen.input_variables,
            callback_manager=callback_manager,
        )

        return cls(
            database=database,
            callback_manager=callback_manager,
            tools=tools,
            llm=llm,
            agent=agent,
        )

    async def generate(
        self,
        run_id: str,
        route: str,
        method: str,
        blocks: List[Dict],
    ):
        self._callback_manager.add_handler(
            LogsCallbackHandler(
                database=self._database,
                run_id=run_id,
                tool_names=self.tool_names(),
            )
        )

        # Retrieve the description block.
        description_block: Dict[str, str] = next(
            b for b in blocks if b.get("type") == "Description"
        )

        # Retrueve the block describing the incoming request payload.
        incoming_request_block: Dict[str, str] | None = next(
            (b for b in blocks if b.get("type") == "RequestBody" and b.get("content")),
            None,
        )

        # Retrieve the instructions block.
        instructions_block: Dict[str, str] | None = next(
            (b for b in blocks if b.get("type") == "Instructions" and b.get("content")),
            None,
        )

        input_vars = {
            "description": description_block["content"],
            "request_body": f"{{\n{incoming_request_block['content']}\n}}"
            if incoming_request_block
            else None,
            "route": route,
            "method": method,
        }

        instructions = "Here are the instructions:"

        # Append the premade prefix instructions.
        for instruction in get_human_instructions_prefix(
            has_request_body=bool(incoming_request_block)
        ):
            instructions += "\n" + f"\n- {instruction['content']}"

        # Append the use instructions
        if instructions_block:
            instructions += (
                + "\nHere are the required implementation instructions:\n"
                + instructions_block["content"]
            )

        # Use the values to format the instruction string.
        instructions = instructions.format(**input_vars)

        print("Instructions:\n", instructions)

        # Append the premade suffix instructions.
        for inst in HUMAN_INSTRUCTIONS_SUFFIX:
            instructions += f"\n{inst}"

        print("Running executor...")
        await self._agent_executor.arun(
            agent_scratchpad="",
            input=instructions,
        )
