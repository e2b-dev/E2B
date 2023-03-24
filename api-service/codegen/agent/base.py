import xml.etree.ElementTree as ET
import re
import traceback

from enum import Enum
from typing_extensions import NotRequired
from typing import Literal, Optional, Tuple, List, Dict, Union, cast
from lxml import etree
from langchain.agents.tools import InvalidTool
from langchain.agents import AgentExecutor
from langchain.agents.chat.base import ChatAgent
from langchain.schema import AgentAction, AgentFinish
from langchain.tools.base import BaseTool
from typing import List, TypedDict


FINAL_ANSWER_ACTION = "Final Answer:"
FINAL_ANSWER_ACTION_NO_WHITESPACE = "FinalAnswer"
ACTIONS_QUEUE = "action_queue"
MALFORMED_ANSWER = "malformed_answer"

escape_table = str.maketrans({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
})

def xml_escape(txt: str):
    return txt.translate(escape_table)

class Log(TypedDict):
    id: NotRequired[str]
    type: Literal["thought"] | Literal["tool"]
    created_at: NotRequired[str]

class ThoughtLog(Log):
    content: str

class ToolLog(Log):
    tool_name: str
    tool_input: str
    tool_output: NotRequired[str]
    finish_at: NotRequired[str]

def merge_dict(t: TypedDict, o: TypedDict):
    t.update(o)

action_tag_open = "<action(\\s+tool=\".+?\")?\\s*\\/?>?"
action_tag_close = "</\\s*action>?"

action_tag_check_pattern = re.compile(f"{action_tag_open}|{action_tag_close}")
action_tag_split_pattern = re.compile(f"({action_tag_open}.*?{action_tag_close})|(.+)")

def parse_text(text: str):
    escaped = "".join(
        # If the text part is not action tag escape it.
        part if action_tag_check_pattern.match(part) else xml_escape(part)
        for part
        # Split the text by action opening and closing tags.
        in re.split(action_tag_split_pattern, text)
        if part
    )

    root = ET.fromstring(
        # Wrapping the XML in a fully formed root tag while some inner tags can be incomplete doesn't make sense.
        f"<root>{escaped}",
        # Use Parser with C binding for libxml2+libxslt, with recovery mode that allows to parse incomplete XML.
        etree.XMLParser(recover=True),
    )

    leading_thought = root.text.strip() if root.text else None
    if leading_thought:
        yield ThoughtLog(type="thought", content=leading_thought)

    for action in root.findall("action"):
        tool_name = action.attrib.get("tool", "")
        if tool_name:
            yield ToolLog(type="tool", tool_name=tool_name, tool_input=action.text or "")

        # Create thoughts from text between and after actions.
        trailing_thought = action.tail.strip() if action.tail else None
        if trailing_thought:
            yield ThoughtLog(type="thought", content=trailing_thought)

class CodegenAgent(ChatAgent):
    def _extract_tool_and_input(self, text: str) -> Optional[Tuple[str, str | None]]:
        if FINAL_ANSWER_ACTION in text:
            return "Final Answer", text.split(FINAL_ANSWER_ACTION)[-1].strip()
        try:
            return ACTIONS_QUEUE, text
        except Exception as e:
            print(traceback.format_exc())
            print("Got exception in `_extract_tool_and_input:\n", e)
            # Sometimes the agent just completely messed up the output format.
            # We want to remind it that the last answer was wrong and it should
            # follow the format.
            # TODO: This doesn't work
            return (
                MALFORMED_ANSWER,
                f"Wrong format! Follow the format! Reminder to ALWAYS use the exact the action `Final Answer` when you know the final answer. I just tried to parse your last reponse with `xml.etree.ElementTree.fromstring()` and received this error:\n{e}Reminder, that you should follow the format I told you!",
            )


class CodegenAgentExecutor(AgentExecutor):
    def _run_tool(
        self,
        tool_name: str,
        tool_input: str,
        color_mapping: Dict[str, str],
        name_to_tool_map: Dict[str, BaseTool],
    ) -> str:
        # Otherwise we lookup the tool
        if tool_name in name_to_tool_map:
            tool = name_to_tool_map[tool_name]
            return_direct = tool.return_direct
            color = color_mapping[tool_name]
            llm_prefix = "" if return_direct else self.agent.llm_prefix
            # We then call the tool on the tool input to get an observation
            observation = tool.run(
                tool_input,
                verbose=self.verbose,
                color=color,
                llm_prefix=llm_prefix,
                observation_prefix=self.agent.observation_prefix,
            )
        else:
            observation = InvalidTool().run(
                tool_name,
                verbose=self.verbose,
                color=None,
                llm_prefix="",
                observation_prefix=self.agent.observation_prefix,
            )
        return observation

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
            return_direct = tool.return_direct
            color = color_mapping[tool_name]
            llm_prefix = "" if return_direct else self.agent.llm_prefix
            # We then call the tool on the tool input to get an observation
            observation = await tool.arun(
                tool_input,
                verbose=self.verbose,
                color=color,
                llm_prefix=llm_prefix,
                observation_prefix=self.agent.observation_prefix,
            )
        else:
            observation = await InvalidTool().arun(
                tool_name,
                verbose=self.verbose,
                color=None,
                llm_prefix="",
                observation_prefix=self.agent.observation_prefix,
            )
        return observation

    async def _atake_next_step(
        self,
        name_to_tool_map: Dict[str, BaseTool],
        color_mapping: Dict[str, str],
        inputs: Dict[str, str],
        intermediate_steps: List[Tuple[AgentAction, str]],
    ) -> Union[AgentFinish, Tuple[AgentAction, str]]:
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
        elif (
            output.tool == FINAL_ANSWER_ACTION
            or output.tool == FINAL_ANSWER_ACTION_NO_WHITESPACE
        ):
            return AgentFinish({"output": output.tool_input}, output.log)

        # Sometimes the agent just completely messed up the output format.
        # We want to remind it that the last answer was wrong and it should
        # follow the format.
        if output.tool == MALFORMED_ANSWER:
            return output, output.tool_input

        if self.callback_manager.is_async:
            await self.callback_manager.on_agent_action(
                output, verbose=self.verbose, color="green"
            )
        else:
            self.callback_manager.on_agent_action(
                output, verbose=self.verbose, color="green"
            )

        # The `ACTIONS_QUEUE` isn't really a name of a tool.
        # It's a way for us to specify that the LLM passed multiple actions in a single response.
        # We handle this case by running each action one by one.
        if output.tool == ACTIONS_QUEUE:
            observation = ""

            # Go through each action and run it.
            # Collect outputs from each action.
            for action in (cast(ToolLog, action) for action in parse_text(output.tool_input) if action["type"] == "tool"):
                observation = await self._arun_tool(
                    tool_name=action["tool_name"],
                    tool_input=action["tool_input"],
                    name_to_tool_map=name_to_tool_map,
                    color_mapping=color_mapping,
                )
                # observation = (
                #     observation
                #     + f"Output of action '{tool_name}':\n"
                #     + self._run_tool(
                #         tool_name=tool_name,
                #         tool_input=tool_input,
                #         name_to_tool_map=name_to_tool_map,
                #         color_mapping=color_mapping,
                #     )
                #     + "==="
                # )

        else:
            observation = await self._arun_tool(
                tool_name=output.tool,
                tool_input=output.tool_input,
                name_to_tool_map=name_to_tool_map,
                color_mapping=color_mapping,
            )
        return output, observation
<<<<<<< HEAD

    def _take_next_step(
        self,
        name_to_tool_map: Dict[str, BaseTool],
        color_mapping: Dict[str, str],
        inputs: Dict[str, str],
        intermediate_steps: List[Tuple[AgentAction, str]],
    ) -> Union[AgentFinish, Tuple[AgentAction, str]]:
        """Take a single step in the thought-action-observation loop.

        Override this to take control of how the agent makes and acts on choices.
        """
        # Call the LLM to see what to do.
        output = self.agent.plan(intermediate_steps, **inputs)

        # If the tool chosen is the finishing tool, then we end and return.
        if isinstance(output, AgentFinish):
            return output
        # Sometimes the LLM decides to pass the value of `FINAL_ANSWER_ACTION` as a tool name.
        # Instead of trying to "force" the LLM to don't do that, we can just write a bit of
        # code and handle this case.
        elif (
            output.tool == FINAL_ANSWER_ACTION
            or output.tool == FINAL_ANSWER_ACTION_NO_WHITESPACE
        ):
            return AgentFinish({"output": output.tool_input}, output.log)

        # Sometimes the agent just completely messed up the output format.
        # We want to remind it that the last answer was wrong and it should
        # follow the format.
        if output.tool == MALFORMED_ANSWER:
            return output, output.tool_input

        self.callback_manager.on_agent_action(
            output, verbose=self.verbose, color="green"
        )

        # The `ACTIONS_QUEUE` isn't really a name of a tool.
        # It's a way for us to specify that the LLM passed multiple actions in a single response.
        # We handle this case by running each action one by one.
        if output.tool == ACTIONS_QUEUE:
            observation = ""

            # The `output.tool_input` is a raw action string
            actions = parse_action_string(output.tool_input)

            # Go through each action and run it.
            # Collect outputs from each action.
            for action in actions:
                tool_name = action.attrib["tool"]
                tool_input = action.text
                observation = self._run_tool(
                    tool_name=tool_name,
                    tool_input=tool_input,
                    name_to_tool_map=name_to_tool_map,
                    color_mapping=color_mapping,
                )
                # observation = (
                #     observation
                #     + f"Output of action '{tool_name}':\n"
                #     + self._run_tool(
                #         tool_name=tool_name,
                #         tool_input=tool_input,
                #         name_to_tool_map=name_to_tool_map,
                #         color_mapping=color_mapping,
                #     )
                #     + "==="
                # )

        else:
            observation = self._run_tool(
                tool_name=output.tool,
                tool_input=output.tool_input,
                name_to_tool_map=name_to_tool_map,
                color_mapping=color_mapping,
            )
        return output, observation
=======
>>>>>>> 3c7509f0f283209afea1f99ce636f6dfcb74d242
