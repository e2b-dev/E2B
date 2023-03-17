from typing import Optional, Tuple, List
import json

from langchain.agents.chat.base import ChatAgent
from langchain.schema import AgentAction

FINAL_ANSWER_ACTION = "Final Answer:"


class CodegenAgent(ChatAgent):
    def _construct_scratchpad(
        self, intermediate_steps: List[Tuple[AgentAction, str]]
    ) -> str:
        # print("CONSTRUCTING SCRATCHPAD before:")
        # print(len(intermediate_steps))

        # Leave only the latest element in the `intermediate_steps` list
        # if len(intermediate_steps) > 4:
        #     intermediate_steps = intermediate_steps[len(intermediate_steps) - 2 :]
        #     print(intermediate_steps)

        # print("CONSTRUCTING SCRATCHPAD after:")
        # print(len(intermediate_steps))

        agent_scratchpad = super()._construct_scratchpad(intermediate_steps)
        # print("=======================SCRATCHPAD:", agent_scratchpad)
        # print("=======================")
        if not isinstance(agent_scratchpad, str):
            raise ValueError("agent_scratchpad should be of type string.")
        if agent_scratchpad:
            return (
                f"This was your previous work "
                f"(but I haven't seen any of it! I only see what "
                f"you return as final answer):\n{agent_scratchpad}"
            )
        else:
            return agent_scratchpad

    def _extract_tool_and_input(self, text: str) -> Optional[Tuple[str, str]]:
        if FINAL_ANSWER_ACTION in text:
            return "Final Answer", text.split(FINAL_ANSWER_ACTION)[-1].strip()
        try:
            # TODO: Here we can change the JSON formated `action` + `action_input` to something
            # more suited to our use-case so the model doesn't need to escape the generated code.
            _, action, _ = text.split("```")
            response = json.loads(action.strip())
            return response["action"], response["action_input"]
        except Exception as e:
            # TODO: I think this is buggy. I haven't really had a chance to properly test it and debug the model's behavior.
            print(f"====== Got exception '{str(e)}'\n text:\n{text}")
            # input = response["action_input"]
            return (
                f"[{text[:50]}...]",
                "",
                # f"You are not following the response format as I told you. I just ran your response via json.loads and received this error\n{str(e)}\nPlease try again and change your response.",
            )
            # raise ValueError(f"Could not parse LLM output: {text}")
