"""Test LLM incomplete action parsing"""

# import pytest

from typing import Dict, List, NamedTuple, Any
from codegen.agent.base import (
    parse_thoughts_and_actions,
    separate_thought_and_action,
    parse_action_string,
)


class Action(NamedTuple):
    tool: str
    input: str


llm_outputs: List[Dict[str, Any]] = [
    {
        "llm_output": """
This is a thought:        
Action:
<action tool="AskHuman">
What should the post request handler do?
</
""",
        "expected_actions": [
            Action("AskHuman", "What should the post request handler do?")
        ],
    },
    {
        "llm_output": """
<action tool="AskHuman">
What should the post request handler do?
</action>
This is a thought:        
Action:
""",
        "expected_actions": [
            Action("AskHuman", "What should the post request handler do?")
        ],
    },
    {
        "llm_output": """
<action tool="AskHuman">
What should the post request handler do?
</action>
This is a thought:        

<?
<action tool="AskHuman">
What
</action>

This is a thought:        

<?
""",
        "expected_actions": [
            Action("AskHuman", "What should the post request handler do?"),
            Action("AskHuman", "What"),
        ],
    },
    {
        "llm_output": """
This is a thought
Greater <?
And action:

<action tool="AskHuman">
What should the post request handler do?
</action>
<action tool="AskHuman">
What
</action>
thought after?
""",
        "expected_actions": [
            Action("AskHuman", "What should the post request handler do?"),
            Action("AskHuman", "What"),
        ],
    },
]


def test_parsing_llm_simple_format_action_output():
    """Test LLM action parsing."""

    for output in llm_outputs:
        # _, action_string = separate_thought_and_action(output["llm_output"])
        # parsed_actions = parse_action_string(output["llm_output"])
        
        thought, parsed_actions = parse_thoughts_and_actions(output["llm_output"])

        # print("Thought", thought)

        for parsed_action, expected_action in zip(
            parsed_actions, output["expected_actions"]
        ):
            # print("Action", parsed_action.text.strip())
            assert parsed_action.attrib["tool"] == expected_action.tool
            assert parsed_action.text.strip().startswith(expected_action.input.strip())

        print("-----------")
