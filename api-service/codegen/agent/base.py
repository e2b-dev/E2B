from typing import Optional, Tuple, List, Dict, Union
import xml.etree.ElementTree as ET

from langchain.agents.tools import InvalidTool
from langchain.agents import AgentExecutor
from langchain.agents.chat.base import ChatAgent
from langchain.schema import AgentAction, AgentFinish
from langchain.tools.base import BaseTool

FINAL_ANSWER_ACTION = "Final Answer:"
ACTIONS_QUEUE = "action_queue"
MALFORMED_ANSWER = "malformed_answer"

# class ActionRouter(BaseTool):
#     name = "action_router"
#     description = "Use this tool when you want to use multiple actions at once"


class CodegenAgent(ChatAgent):
    # def _construct_scratchpad(
    #     self, intermediate_steps: List[Tuple[AgentAction, str]]
    # ) -> str:
    #     # print("CONSTRUCTING SCRATCHPAD before:")
    #     # print(len(intermediate_steps))

    #     # Leave only the latest element in the `intermediate_steps` list
    #     # if len(intermediate_steps) > 4:
    #     #     intermediate_steps = intermediate_steps[len(intermediate_steps) - 2 :]
    #     #     print(intermediate_steps)

    #     # print("CONSTRUCTING SCRATCHPAD after:")
    #     # print(len(intermediate_steps))

    #     agent_scratchpad = super()._construct_scratchpad(intermediate_steps)
    #     # print("=======================SCRATCHPAD:", agent_scratchpad)
    #     # print("=======================")
    #     if not isinstance(agent_scratchpad, str):
    #         raise ValueError("agent_scratchpad should be of type string.")
    #     if agent_scratchpad:
    #         return (
    #             f"This was your previous work "
    #             f"(but I haven't seen any of it! I only see what "
    #             f"you return as final answer):\n{agent_scratchpad}"
    #         )
    #     else:
    #         return agent_scratchpad

    def _extract_tool_and_input(self, text: str) -> Optional[Tuple[str, str]]:
        if FINAL_ANSWER_ACTION in text:
            return "Final Answer", text.split(FINAL_ANSWER_ACTION)[-1].strip()
        try:
            _, action, _ = text.split("```")
            root = ET.fromstring(f"<root>{action.strip()}</root>")
            actions = root.findall("action")

            # We handle the case when the LLM starts specifying multiple actions in a single response.
            if len(actions) > 1:
                return ACTIONS_QUEUE, action.strip()
            else:
                return actions[0].attrib["tool"], actions[0].text
        except Exception as e:
            # Sometimes the agent just completely messed up the output format.
            # We want to remind it that the last answer was wrong and it should
            # follow the format.
            return (
                MALFORMED_ANSWER,
                """I just tried to parse your last reponse and received this error:
            {e}
            Reminder, that you should follow the format I told you!""",
            )
            # TODO: I think this is buggy. I haven't really had a chance to properly test it and debug the model's behavior.
            print(f"====== Got exception '{str(e)}'\n text:\n{text}")
            # input = response["action_input"]
            return (
                f"[{text[:50]}...]",
                "",
                # f"You are not following the response format as I told you. I just ran your response via json.loads and received this error\n{str(e)}\nPlease try again and change your response.",
            )
            # raise ValueError(f"Could not parse LLM output: {text}")


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
        elif output.tool == FINAL_ANSWER_ACTION:
            return AgentFinish({"output": action.tool_input}, action.log)

        self.callback_manager.on_agent_action(
            output, verbose=self.verbose, color="green"
        )

        # Sometimes the agent just completely messed up the output format.
        # We want to remind it that the last answer was wrong and it should
        # follow the format.
        if output.tool == MALFORMED_ANSWER:
            return output, output.tool_input

        # The `ACTIONS_QUEUE` isn't really a name of a tool.
        # It's a way for us to specify that the LLM passed multiple actions in a single response.
        # We handle this case by running each action one by one.
        if output.tool == ACTIONS_QUEUE:
            observation = ""
            # The `output.tool_input` is a XML tree with multiple actions
            # Go through each action and run it.
            # Collect outputs from each action.
            root = ET.fromstring(f"<root>{output.tool_input.strip()}</root>")
            actions = root.findall("action")
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
