from typing import Optional, Tuple, List, Dict, Union, cast
from langchain.agents.tools import InvalidTool
from langchain.agents import AgentExecutor
from langchain.agents.chat.base import ChatAgent
from langchain.schema import AgentAction, AgentFinish
from langchain.tools.base import BaseTool

from codegen.agent.parsing import parse_thoughts_and_actions, ToolLog


FINAL_ANSWER_ACTION = "Final Answer:"
FINAL_ANSWER_ACTION_NO_WHITESPACE = "FinalAnswer"

ACTIONS_QUEUE = "actions_queue"
MALFORMED_ANSWER = "malformed_answer"


class CodegenAgent(ChatAgent):
    def _extract_tool_and_input(self, text: str) -> Optional[Tuple[str, str | None]]:
        # if any(trigger in text for trigger in FINAL_ANSWER_TRIGGERS):
        if FINAL_ANSWER_ACTION in text:
            return "Final Answer", text.split(FINAL_ANSWER_ACTION)[-1].strip()
        # `ACTIONS_QUEUE` is not a real tool. The original implementation of `extract_tool_and_input` parses LLM's output. Our override doesn't do that.
        # Instead, we parse the LLM's output inside the `_atake_next_step` of the AgentExecutor. We do that because sometimes the LLM malforms
        # the desired format we specified in the prompt and puts <action> tags in the wrong place.
        # We say "the raw LLM's output is an input of ACTIONS_QUEUE tool" and parse the ACTIONS_QUEUE "tool" in the `_atake_next_step` while trying to be more resilient towards
        # malforrmed input and <action> tags in unexpected places.
        return ACTIONS_QUEUE, text


class CodegenAgentExecutor(AgentExecutor):
    async def _arun_tool(
        self,
        tool_name: str,
        tool_input: str,
        color_mapping: Dict[str, str],
        name_to_tool_map: Dict[str, BaseTool],
    ) -> str:
        # Otherwise we lookup the tool
        if tool_name in name_to_tool_map:
            tool = name_to_tool_map[tool_name]
            color = color_mapping[tool_name]
            # We then call the tool on the tool input to get an observation
            observation = await tool.arun(
                tool_input,
                verbose=self.verbose,
                color=color,
            )
        else:
            observation = await InvalidTool().arun(  # type: ignore
                tool_name=tool_name,
                tool_input=tool_input,
                verbose=self.verbose,
                color=None,
            )
        return observation

    async def _atake_next_step(
        self,
        name_to_tool_map: Dict[str, BaseTool],
        color_mapping: Dict[str, str],
        inputs: Dict[str, str],
        intermediate_steps: List[Tuple[AgentAction, str]],
    ) -> Union[AgentFinish, List[Tuple[AgentAction, str]]]:
        """Take a single step in the thought-action-observation loop.

        Override this to take control of how the agent makes and acts on choices.
        """
        # Call the LLM to see what to do.
        output = await self.agent.aplan(intermediate_steps, **inputs)
        # If the tool chosen is the finishing tool, then we end and return.
        if isinstance(output, AgentFinish):
            return output
        # Sometimes the LLM decides to pass the value of `FINAL_ANSWER_ACTION` as a tool name.
        # Instead of trying to "force" the LLM to don't do that, we can just write a bit of
        # code and handle this case.

        actions = [output] if isinstance(output, AgentAction) else output

        # TODO: Handle malformed actions
        # Sometimes the agent just completely messed up the output format.
        # We want to remind it that the last answer was wrong and it should
        # follow the format.

        observations: List[Tuple[AgentAction, str]] = []

        for action in actions:
            if self.callback_manager.is_async:
                await self.callback_manager.on_agent_action(
                    action,
                    verbose=self.verbose,
                    color="green",
                )
            else:
                self.callback_manager.on_agent_action(
                    action,
                    verbose=self.verbose,
                    color="green",
                )

            if action.tool in (
                FINAL_ANSWER_ACTION,
                FINAL_ANSWER_ACTION_NO_WHITESPACE,
            ):
                return AgentFinish({"output": action.tool_input}, action.log)

            # Parse action queues
            tools = self.unwrap_actions_queue(action)

            tools_observations: List[str] = []

            for tool in tools:
                # We are running the tools one after another instead of using async gather
                # because order matter for the playground tools.
                tool_observation = await self._arun_tool(
                    tool_name=tool["tool_name"],
                    tool_input=tool["tool_input"],
                    name_to_tool_map=name_to_tool_map,
                    color_mapping=color_mapping,
                )
                tools_observations.append(tool_observation)

            # We don't return tool but the actions queue because we cannot reasonable reconstruct the log for each tool and we also want the "Thought" part to be there.
            observations.append((action, "\n".join(tools_observations)))

        return observations

    def unwrap_actions_queue(self, action: AgentAction):
        if action.tool == ACTIONS_QUEUE:
            yield from (
                cast(ToolLog, action)
                for action in parse_thoughts_and_actions(action.tool_input)
                if action["type"] == "tool"
            )
