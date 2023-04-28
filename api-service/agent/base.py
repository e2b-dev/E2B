import asyncio
import uuid

from abc import abstractmethod
from typing import Any, Dict, List, Literal, cast
from agent.output.parse_output import ToolLog
from agent.output.output_stream_parser import OutputStreamParser, Step
from agent.output.token_callback_handler import TokenCallbackHandler
from agent.output.work_queue import WorkQueue
from langchain.callbacks.base import AsyncCallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.chains.llm import LLMChain
from langchain.schema import BaseMessage
from langchain.tools import BaseTool
from langchain.prompts.chat import (
    BaseMessagePromptTemplate,
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain.agents.tools import InvalidTool

from agent.tools.base import create_tools
from database.database import DeploymentState
from models.base import ModelConfig, PromptPart, get_model
from database import db
from session import NodeJSPlayground


class RewriteStepsException(Exception):
    pass


class AgentRun:
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.should_pause = False
        self.canceled = False
        self.rewriting_steps = False
        self.can_resume = asyncio.Event()

    @staticmethod
    async def _run_tool(
        tool_log: ToolLog,
        name_to_tool_map: Dict[str, BaseTool],
    ) -> str:
        # Otherwise we lookup the tool
        if tool_log["tool_name"] in name_to_tool_map:
            tool = name_to_tool_map[tool_log["tool_name"]]
            # We then call the tool on the tool input to get an observation
            observation = await tool.arun(
                tool_log["tool_input"],
                verbose=True,
            )
        else:
            observation = await InvalidTool().arun(  # type: ignore
                tool_name=tool_log["tool_name"],
                tool_input=tool_log["tool_input"],
                verbose=True,
            )
        return observation

    @staticmethod
    def _get_prompt_part(
        prompts: List[PromptPart],
        role: Literal["user", "system"],
        type: str,
    ):
        return (
            next(
                prompt
                for prompt in prompts
                if prompt.role == role and prompt.type == type
            )
            # Double the parenthesses to escape them because the string will be prompt templated.
            .content.replace("{", "{{").replace("}", "}}")
        )

    @staticmethod
    def _create_prompt(model_config: ModelConfig, tools: List[BaseTool]):
        system_template = "\n\n".join(
            [
                AgentRun._get_prompt_part(model_config.prompt, "system", "prefix"),
                "\n".join([f"{tool.name}: {tool.description}" for tool in tools]),
                AgentRun._get_prompt_part(model_config.prompt, "system", "suffix"),
            ]
        )
        human_template = "\n\n".join(
            [
                AgentRun._get_prompt_part(model_config.prompt, "user", "prefix"),
                "{agent_scratchpad}",
            ]
        )

        messages: List[BaseMessage | BaseMessagePromptTemplate] = [
            SystemMessagePromptTemplate.from_template(system_template),
            HumanMessagePromptTemplate.from_template(human_template),
        ]
        return ChatPromptTemplate(
            input_variables=["agent_scratchpad"],
            messages=messages,
        )

    async def _run(
        self,
        run_id: str,
        project_id: str,
        model_config: ModelConfig,
    ):
        async def change_state(state: DeploymentState) -> None:
            print(f"Run '{run_id}'", state.value, flush=True)
            await db.upsert_deployment_state(
                run_id=run_id,
                project_id=project_id,
                state=state,
            )

        playground = None
        await change_state(DeploymentState.Generating)
        try:
            # -----
            # Initialize callback manager and handler for controlling token stream
            callback_manager = AsyncCallbackManager([StreamingStdOutCallbackHandler()])
            self.token_handler = TokenCallbackHandler()
            callback_manager.add_handler(self.token_handler)

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
            self.tool_names = [tool.name for tool in tools]
            tool_map = {tool.name: tool for tool in tools}

            # Assign callback manager to tools
            for tool in tools:
                tool.callback_manager = callback_manager

            # -----
            # Create LLM from specified model
            llm_chain = LLMChain(
                llm=get_model(model_config, callback_manager),
                prompt=self._create_prompt(model_config, tools),
                callback_manager=callback_manager,
            )

            # -----
            # Create log handlers
            # Used for sending logs to db/frontend without blocking
            ws_streamer = WorkQueue[List[Step]](
                on_workload=lambda steps: self._notify("steps", {"steps": steps})
            )
            db_streamer = WorkQueue[List[Step]](
                on_workload=lambda steps: db.upsert_deployment_steps(
                    run_id=self.run_id,
                    steps=steps,
                    project_id=project_id,
                )
            )

            def stream_steps(steps: List[Step]):
                db_streamer.schedule(steps)
                ws_streamer.schedule(steps)

            # Used for parsing token stream into logs+actions
            self._output_parser = OutputStreamParser(tool_names=self.tool_names)

            # -----
            # List of (LLM output, parsed logs)
            steps: List[Step] = []

            # This function is used to inject information from previous steps to the current prompt
            def get_agent_scratchpad():
                if len(steps) == 0:
                    return ""

                agent_scratchpad = ""
                for step in steps:
                    agent_scratchpad += step["output"]

                    tool_logs = (
                        cast(ToolLog, action)
                        for action in step["logs"]
                        if action["type"] == "tool"
                    )

                    tool_outputs = "\n".join(
                        log.get("tool_output", "")
                        for log in tool_logs
                        if log.get("tool_output")
                    )

                    if tool_outputs:
                        agent_scratchpad += f"\nObservation: {tool_outputs}\nThought:"

                return (
                    f"This was your previous work "
                    f"(but I haven't seen any of it! I only see what "
                    f"you return as final answer):\n{agent_scratchpad}"
                )

            print("Generating...", flush=True)
            while True:
                try:
                    await self._check_interrupt()
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
                        token = await self.token_handler.retrieve_token()

                        if token is None:
                            break

                        await self._check_interrupt()
                        steps = self._output_parser.ingest_token(token).get_steps()
                        stream_steps(steps)

                    current_step = self._output_parser.get_current_step()

                    # Check if the run is finished
                    if any(
                        keyword in current_step["output"]
                        for keyword in ("Final Answer", "FinalAnswer")
                    ):
                        break

                    for tool in (
                        cast(ToolLog, action)
                        for action in current_step["logs"]
                        if action["type"] == "tool"
                    ):
                        await self._check_interrupt()
                        tool_output = await self._run_tool(
                            tool,
                            name_to_tool_map=tool_map,
                        )
                        await self._check_interrupt()
                        steps = self._output_parser.ingest_tool_output(
                            tool_output
                        ).get_steps()
                        stream_steps(steps)

                except RewriteStepsException:
                    continue

            await change_state(DeploymentState.Finished)
        except:
            await change_state(DeploymentState.Error)
            raise
        finally:
            if playground is not None:
                playground.close()
            await self._close()

    async def _check_interrupt(self):
        if self.canceled:
            raise Exception("Canceled")

        if self.should_pause:
            await self.can_resume.wait()
            self.can_resume.clear()

        if self.rewriting_steps:
            self.rewriting_steps = False
            raise RewriteStepsException()

    @abstractmethod
    async def _notify(self, method: str, params: Dict[str, Any]):
        pass

    @abstractmethod
    async def _close():
        pass

    async def start(self, project_id: str, model_config: Dict[str, Any]):
        print("Start agent run")
        self.project_id = project_id
        self.run_id = str(uuid.uuid4())
        asyncio.create_task(
            self._run(
                run_id=self.run_id,
                project_id=project_id,
                model_config=ModelConfig(**model_config),
            )
        )
        return {"run_id": self.run_id}

    async def pause(self):
        print("Pause agent run")
        self.should_pause = True

    async def resume(self):
        print("Resume agent run")
        self.should_pause = False
        self.can_resume.set()

    async def cancel(self):
        print("Cancel agent run")
        self.canceled = True
        if self.llm_generation:
            self.llm_generation.cancel()
        await self._close()

    async def rewrite_steps(self, steps: List[Step]):
        print("Rewrite agent run steps")
        await self.pause()
        self.rewriting_steps = True
        if self.llm_generation:
            self.llm_generation.cancel()
        self._output_parser = OutputStreamParser(
            tool_names=self.tool_names,
            steps=steps[:-1],
            buffered_step=steps[-1],
        )
        await self.resume()
