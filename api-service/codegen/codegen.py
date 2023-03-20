from typing import (
    List,
    List,
    Any,
    Dict,
    ClassVar,
)
from codegen.tools.human.ask import AskHuman
from langchain.agents import AgentExecutor
from pydantic import BaseModel, PrivateAttr
from langchain.chat_models import ChatOpenAI
from langchain.callbacks.base import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.tools import BaseTool

from session.playground import NodeJSPlayground
from session.env import EnvVar
from database import Database
from codegen.agent import CodegenAgent, CodegenAgentExecutor
from codegen.prompt import (
    PREFIX,
    SUFFIX,
    FORMAT_INSTRUCTIONS,
    HUMAN_INSTRUCTIONS_PREFIX,
    HUMAN_INSTRUCTIONS_SUFFIX,
)
from .callback_handler import CustomCallbackHandler

# class OutputFinalCode(BaseTool):
#     name = "OutputFinalCode"
#     description = "This is the last tool you would use. You use it when you know the final server code and you want to output it. The input should be the final server code that does what the user required."

#     def _run(self, final_code: str) -> str:
#         return final_code

#     async def _arun(self, final_code: str) -> str:
#         raise NotImplementedError("OutputFinalCode does not support async")


#     testing_instructions = """Here are your instructions:
# 1. Extract `email` from the incoming POST request.
# 2. If there's no email, respond back with an error.
# 3. Otherwise, respond back with the part of the email before the '@' sign.
# 4. Generate the full required server code and make sure it starts without any errors.
# 5. Test that the generated server from the previous step behaves as is required by making mock `curl` requests to the server.
# 6. Once all works without any bugs and errors, write the code to the file.
# 7. Deploy the code.
# """


class Codegen(BaseModel):
    input_variables: ClassVar[List[str]] = ["input", "agent_scratchpad", "method"]
    _agent: CodegenAgent = PrivateAttr()
    _agent_executor: AgentExecutor = PrivateAttr()
    _tools: List[BaseTool] = PrivateAttr()
    _llm: ChatOpenAI = PrivateAttr()
    _database: Database = PrivateAttr()
    _callback_manager: CallbackManager = PrivateAttr()

    def __init__(
        self,
        database: Database,
        callback_manager: CallbackManager,
        tools: List[BaseTool],
        llm: ChatOpenAI,
        agent: CodegenAgent,
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

    @classmethod
    def from_playground_and_database(
        cls,
        playground_tools: List[BaseTool],
        database: Database,
        run_id: str,
        playground: NodeJSPlayground,
    ):
        callback_manager = CallbackManager(
            [
                StreamingStdOutCallbackHandler(),
                # CustomCallbackHandler(database=database),
            ]
        )

        # Assign custom callback manager to all playground tools
        for tool in playground_tools:
            tool.callback_manager = callback_manager

        # Prepare tools for Codegen
        tools = [
            # InvalidTool(),
            # OutputFinalCode(),
            *playground_tools,
            # AskHuman(
            #     callback_manager=callback_manager,
            #     run_id=run_id,
            #     playground=playground,
            #     name="AskHuman",
            #     description="You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human.",
            # ),
            # WriteCodeToFile(callback_manager=callback_manager),
            # DeployCode(callback_manager=callback_manager),
        ]

        # Create the LLM
        llm = ChatOpenAI(
            streaming=True,
            temperature=0,
            max_tokens=2056,
            verbose=True,
            callback_manager=callback_manager,
        )

        # Create CodegenAgent
        agent = CodegenAgent.from_llm_and_tools(
            llm=llm,
            tools=tools,
            prefix=PREFIX,
            suffix=SUFFIX,
            format_instructions=FORMAT_INSTRUCTIONS,
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

    def generate(
        self,
        envs: List[EnvVar],
        run_id: str,
        route: str,
        method: str,
        blocks: List[Dict],
    ):
        print("Added handler")
        self._callback_manager.add_handler(
            CustomCallbackHandler(database=self._database, run_id=run_id)
        )

        input_vars = {
            "route": route,
            "method": method,
        }
        instructions = "Here are the instructions:"
        inst_idx = 0

        # Append the premade prefix instructions.
        for instruction in HUMAN_INSTRUCTIONS_PREFIX:
            inst_idx += 1

            values = []
            # Extract the correct values from `input_vars` based on the keys.
            for k, v in input_vars.items():
                if k in instruction["variables"]:
                    values.append(v)

            # Use the values to format the instruction string.
            inst = instruction["content"].format(*values)
            instructions = instructions + "\n" + f"{inst_idx}. {inst}"

        for block in blocks:
            if block.get("type") == "Basic":
                inst_idx += 1
                instructions = instructions + "\n" + f"{inst_idx}. " + block["prompt"]

        # Append the premade suffix instructions.
        for inst in HUMAN_INSTRUCTIONS_SUFFIX:
            inst_idx += 1
            instructions = instructions + "\n" + f"{inst_idx}. {inst}"

        print("Instructions:\n", instructions)

        print("Running executor...")
        self._agent_executor.run(
            agent_scratchpad="",
            # input=testing_instructions
            input=instructions,
            method=method,
        )
