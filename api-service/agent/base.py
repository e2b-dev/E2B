import asyncio
import uuid

from abc import abstractmethod
from typing import Any, Dict, List, Literal, Tuple, cast
from agent.tokens.parsing import ThoughtLog, ToolLog
from agent.tokens.log_parser import LogStreamParser
from agent.tokens.logs import LogsCallbackHandler
from langchain.callbacks.base import AsyncCallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.chains.llm import LLMChain
from langchain.schema import AgentAction, BaseMessage
from langchain.tools import BaseTool
from pydantic import BaseModel
from langchain.prompts.chat import (
    BaseMessagePromptTemplate,
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)

from agent.tokens.token_streamer import TokenStreamer
from agent.tokens.log_processor import LogProcessor
from agent.tools.base import create_tools
from database.database import DeploymentState
from models.base import ModelConfig, PromptPart, get_model
from database import db
from session import NodeJSPlayground

FINAL_ANSWERS = ("Final Answer", "FinalAnswer")


class RewriteHistoryException(Exception):
    pass


class AgentRun(BaseModel):
    should_pause = False
    canceled = False
    rewriting_history = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.can_resume = asyncio.Event()

    async def _arun_tool(
        self,
        tool_name: str,
        tool_input: str,
        name_to_tool_map: Dict[str, BaseTool],
    ) -> str:
        # Otherwise we lookup the tool
        if tool_name in name_to_tool_map:
            tool = name_to_tool_map[tool_name]
            # We then call the tool on the tool input to get an observation
            observation = await tool.arun(
                tool_input,
                verbose=True,
            )
        else:
            observation = await InvalidTool().arun(  # type: ignore
                tool_name=tool_name,
                tool_input=tool_input,
                verbose=True,
            )
        return observation

    @abstractmethod
    async def _notify(self, method: str, params: Dict[str, Any] | List[Any]):
        pass

    @staticmethod
    def _get_prompt_part(
        prompts: List[PromptPart], role: Literal["user", "system"], type: str
    ):
        return (
            next(
                (
                    prompt
                    for prompt in prompts
                    if prompt.role == role and prompt.type == type
                ),
            )
            .content.replace("{", "{{")
            .replace("}", "}}")
        )

    async def _run(
        self,
        run_id: str,
        project_id: str,
        model_config: ModelConfig,
    ):
        async def change_state(state: DeploymentState) -> None:
            print(f"Run '{run_id}'", state.value, flush=True)
            await self._notify("state_update", {"state": state.value})
            await db.upsert_deployment(
                run_id=run_id,
                project_id=project_id,
                state=state,
            )
            print("Changed state")

        playground = None
        await change_state(DeploymentState.Generating)
        try:
            # -----
            # Initialize callback manager for controlling token stream
            streamer = TokenStreamer()
            callback_manager = AsyncCallbackManager([StreamingStdOutCallbackHandler()])
            callback_manager.add_handler(LogsCallbackHandler(streamer=streamer))

            # -----
            # Create tools
            # Create playground for code tools
            playground = NodeJSPlayground(get_envs=lambda: db.get_env_vars(project_id))
            tools = list(
                create_tools(
                    run_id=run_id,
                    playground=playground,
                )
            )
            tool_names = [tool.name for tool in tools]
            tool_map = {tool.name: tool for tool in tools}

            # Assign callback manager to tools
            for tool in tools:
                tool.callback_manager = callback_manager

            # -----
            # Create prompt
            system_template = "\n\n".join(
                [
                    self._get_prompt_part(model_config.prompt, "system", "prefix"),
                    "\n".join([f"{tool.name}: {tool.description}" for tool in tools]),
                    self._get_prompt_part(model_config.prompt, "system", "suffix"),
                ]
            )
            human_template = "\n\n".join(
                [
                    self._get_prompt_part(model_config.prompt, "user", "prefix"),
                    "{agent_scratchpad}",
                ]
            )

            messages: List[BaseMessage | BaseMessagePromptTemplate] = [
                SystemMessagePromptTemplate.from_template(system_template),
                HumanMessagePromptTemplate.from_template(human_template),
            ]
            prompt = ChatPromptTemplate(
                input_variables=["agent_scratchpad"],
                messages=messages,
            )

            # -----
            # Create LLM from specified model
            llm_chain = LLMChain(
                llm=get_model(model_config, callback_manager),
                prompt=prompt,
                callback_manager=callback_manager,
            )

            # -----
            # Create log handlers
            # TODO: Keep track of logs generations - we may need to purge them on rewrite
            self.logs: List[ThoughtLog | ToolLog] = []
            # Used for sending logs to db/frontend without blocking
            log_processor = LogProcessor(
                on_logs=lambda logs: self._notify("logs", {"logs": logs})
            )
            # Used for parsing token stream into logs+actions
            log_parser = LogStreamParser(tool_names=tool_names)

            # -----
            # Initialize intermediate_steps that keeps state between LLM calls
            self.intermediate_steps: List[Tuple[AgentAction, str]] = []

            # This function is used to inject information from previous runs to the prompt
            def get_agent_scratchpad():
                agent_scratchpad = ""
                for action, observation in self.intermediate_steps:
                    agent_scratchpad += action.log
                    agent_scratchpad += f"\nObservation: {observation}\nThought:"

                return (
                    f"This was your previous work "
                    f"(but I haven't seen any of it! I only see what "
                    f"you return as final answer):\n{agent_scratchpad}"
                )

            print("Generating...", flush=True)
            while True:
                try:
                    # Query the LLM in background
                    self.llm_generation = asyncio.create_task(
                        llm_chain.agenerate(
                            [
                                {
                                    "agent_scratchpad": get_agent_scratchpad(),
                                    "stop": "Observation:",
                                }
                            ]
                        )
                    )
                    while True:
                        await self._check_interrupt()
                        # Consume the tokens from LLM
                        token = await streamer.retrieve()

                        if token is None:
                            break

                        self.logs = log_parser.ingest_token(token).get_logs()
                        log_processor.ingest(self.logs)

                    # Check if the the run is finished
                    if any(
                        final in log_parser._token_buffer for final in FINAL_ANSWERS
                    ):
                        break

                    observations: List[str] = []

                    for tool in (
                        cast(ToolLog, action)
                        for action in self.logs
                        if action["type"] == "tool"
                    ):
                        await self._check_interrupt()
                        output = await self._arun_tool(
                            tool_name=tool["tool_name"],
                            tool_input=tool["tool_input"],
                            name_to_tool_map=tool_map,
                        )
                        self.logs = log_parser.ingest_tool_output(output).get_logs()
                        log_processor.ingest(self.logs)

                        observations.append(output)

                    self.intermediate_steps.append(
                        (
                            AgentAction("Action", "", log_parser._token_buffer),
                            "\n".join(observations),
                        )
                    )

                except RewriteHistoryException:
                    self.logs = log_parser.ingest_complete_llm_output("").get_logs()
                    continue

            await change_state(DeploymentState.Finished)
        except:
            await change_state(DeploymentState.Error)
            raise
        finally:
            if playground is not None:
                playground.close()

    async def _check_interrupt(self):
        if self.canceled:
            raise Exception("Canceled")

        if self.should_pause:
            await self.can_resume.wait()
            self.can_resume.clear()

        if self.rewriting_history:
            self.rewriting_history = False
            raise RewriteHistoryException()

    async def start(self, project_id: str, model_config: Dict[str, Any]):
        run_id = str(uuid.uuid4())
        asyncio.create_task(
            self._run(
                run_id=run_id,
                project_id=project_id,
                model_config=ModelConfig(**model_config),
            )
        )
        return {"run_id": run_id}

    def pause(self):
        self.should_pause = True

    def resume(self):
        self.can_resume.set()

    def cancel(self):
        self.canceled = True
        # Ensure that the agent run is not stuck on paused
        self.resume()

    def rewrite_history(self):
        self.pause()
        # TODO: Check if there could be any unflushed tokens after cancel
        self.llm_generation.cancel()
        # TODO: Change self.intermediate_steps to reflect the modified history
        self.rewriting_history = True
        self.resume()
