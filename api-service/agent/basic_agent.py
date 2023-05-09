import asyncio
import uuid
import chevron

# Monkey patch chevron to not escape html
chevron.render.__globals__["_html_escape"] = lambda string: string

from typing import Any, Dict, List, Literal, cast
from langchain.agents.tools import InvalidTool
from langchain.callbacks.base import AsyncCallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.chains.llm import LLMChain
from langchain.schema import BaseMessage, SystemMessage, HumanMessage
from langchain.tools import BaseTool
from langchain.prompts.chat import (
    AIMessagePromptTemplate,
    BaseMessagePromptTemplate,
    ChatPromptTemplate,
)


from agent.base import (
    AgentInteraction,
    OnLogs,
    OnInteractionRequest,
)
from agent.output.parse_output import ToolLog
from agent.output.output_stream_parser import OutputStreamParser, Step
from agent.output.token_callback_handler import TokenCallbackHandler
from agent.output.work_queue import WorkQueue
from agent.tools.base import create_tools
from models.base import ModelConfig, PromptPart, get_model
from agent.base import AgentBase, AgentInteractionRequest, GetEnvs
from session import NodeJSPlayground


class RewriteStepsException(Exception):
    pass


class BasicAgent(AgentBase):
    def __init__(
        self,
        config: Any,
        get_envs: GetEnvs,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
    ):
        super().__init__()
        self.get_envs = get_envs
        self.config = ModelConfig(**config)
        self.on_interaction_request = on_interaction_request
        self.on_logs = on_logs
        self.should_pause = False
        self.canceled = False
        self.rewriting_steps = False
        self.llm_generation = None
        self.can_resume = asyncio.Event()

    @classmethod
    async def create(
        cls,
        config: Any,
        get_envs: GetEnvs,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
    ):
        return cls(
            config,
            get_envs,
            on_logs,
            on_interaction_request,
        )

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
            .content
        )

    @staticmethod
    def _create_prompt(
        config: ModelConfig,
        tools: List[BaseTool],
        instructions: Any,
    ):
        system_template = chevron.render(
            "\n\n".join(
                [
                    BasicAgent._get_prompt_part(config.prompt, "system", "prefix"),
                    "\n".join([f"{tool.name}: {tool.description}" for tool in tools]),
                    BasicAgent._get_prompt_part(config.prompt, "system", "suffix"),
                ]
            ),
            instructions,
        )

        human_template = chevron.render(
            "\n\n".join(
                [
                    BasicAgent._get_prompt_part(config.prompt, "user", "prefix"),
                ]
            ),
            instructions,
        )

        messages: List[
            BaseMessage | BaseMessagePromptTemplate | SystemMessage | HumanMessage
        ] = [
            SystemMessage(content=system_template),
            HumanMessage(content=human_template),
            AIMessagePromptTemplate.from_template("{agent_scratchpad}"),
        ]
        return ChatPromptTemplate(
            input_variables=["agent_scratchpad"],
            messages=messages,
        )

    async def _run(self, instructions: Any):
        playground = None
        try:
            # -----
            # Initialize callback manager and handler for controlling token stream
            callback_manager = AsyncCallbackManager([StreamingStdOutCallbackHandler()])
            self.token_handler = TokenCallbackHandler()
            callback_manager.add_handler(self.token_handler)

            # -----
            # Create tools
            # Create playground for code tools
            playground = NodeJSPlayground(get_envs=self.get_envs)
            tools = list(create_tools(playground=playground))
            self.tool_names = [tool.name for tool in tools]
            tool_map = {tool.name: tool for tool in tools}

            # Assign callback manager to tools
            for tool in tools:
                tool.callback_manager = callback_manager

            # -----
            # Create LLM from specified model
            llm_chain = LLMChain(
                llm=get_model(self.config, callback_manager),
                prompt=self._create_prompt(self.config, tools, instructions),
                callback_manager=callback_manager,
            )

            # -----
            # Create log handlers
            # Used for sending logs to db/frontend without blocking
            steps_streamer = WorkQueue[List[Step]](
                on_workload=lambda steps: self.on_logs(steps),
            )

            def stream_steps(steps: List[Step]):
                steps_streamer.schedule(steps)

            # Used for parsing token stream into logs+actions
            self._output_parser = OutputStreamParser(tool_names=self.tool_names)

            # This function is used to inject information from previous steps to the current prompt
            # TODO: Improve the scratchpad handling and prompts for templates
            def get_agent_scratchpad():
                steps = self._output_parser.get_steps()

                if (
                    len(steps) == 0
                    or len(steps) == 1
                    and not self._output_parser._token_buffer
                ):
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

                return f"This is my previous work (I will continue where I left off):\n{agent_scratchpad}"

            print("Generating...", flush=True)
            while True:
                try:
                    await self._check_interrupt()
                    # Query the LLM in background
                    scratchpad = get_agent_scratchpad()
                    self.llm_generation = asyncio.create_task(
                        llm_chain.agenerate(
                            [
                                {
                                    "agent_scratchpad": scratchpad,
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
                        self._output_parser.ingest_token(token)
                        stream_steps(self._output_parser.get_steps())

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
                        self._output_parser.ingest_tool_output(tool_output)
                        stream_steps(self._output_parser.get_steps())

                except RewriteStepsException:
                    print("REWRITING")
                    continue

        except:
            raise
        finally:
            if playground is not None:
                playground.close()
            await self.on_interaction_request(
                AgentInteractionRequest(
                    interaction_id=str(uuid.uuid4()),
                    type="done",
                )
            )

    async def _check_interrupt(self):
        if self.canceled:
            raise Exception("Canceled")

        if self.should_pause:
            await self.can_resume.wait()
            self.can_resume.clear()

        if self.rewriting_steps:
            self.rewriting_steps = False
            raise RewriteStepsException()

    async def _start(self, instructions: Any):
        print("Start agent run")
        asyncio.create_task(
            self._run(
                instructions=instructions,
            )
        )

    async def _pause(self):
        print("Pause agent run")
        self.should_pause = True

    async def _resume(self):
        print("Resume agent run")
        self.should_pause = False
        self.can_resume.set()

    async def _rewrite_steps(self, steps: List[Step]):
        print("Rewrite agent run steps")
        await self._pause()
        self.rewriting_steps = True
        if self.llm_generation:
            self.llm_generation.cancel()
        # TODO: Communicate the rewriting in model prompt - inform about what was rewritten.
        # TODO: Handle token that is generated after a rewrite - if the current step seems "finished" the model still outputs string (usually something like . or :).
        self._output_parser = OutputStreamParser(
            tool_names=self.tool_names,
            steps=steps[:-1],
            buffered_step=steps[-1],
        )
        await self._resume()

    async def interaction(self, interaction: AgentInteraction):
        print("Agent interaction")
        match interaction.type:
            case "pause":
                await self._pause()
            case "resume":
                await self._resume()
            case "start":
                await self._start(interaction.data["instructions"])
            case "rewrite_steps":
                await self._rewrite_steps(interaction.data["steps"])
            case default:
                raise Exception(f"Unknown interaction action: {interaction.type}")

    async def stop(self):
        print("Cancel agent run")
        self.canceled = True
        if self.llm_generation:
            self.llm_generation.cancel()
