"""Test LLM incomplete action parsing"""

# import pytest

from typing import Dict, List, NamedTuple, Any
from codegen.agent.base import (
    separate_thought_and_action,
    parse_action_string,
)


class Action(NamedTuple):
    tool: str
    input: str


llm_outputs: List[Dict[str, Any]] = [
    {
        "llm_output": """Action:
```
<action tool="AskHuman">
What should the post request handler do?
</
```""",
        "expected_actions": [
            Action("AskHuman", "What should the post request handler do?")
        ],
    },
]


def test_parsing_llm_incomplete_action_output():
    """Test LLM action parsing."""

    for output in llm_outputs:
        _, action_string = separate_thought_and_action(output["llm_output"])
        parsed_actions = parse_action_string(action_string)

        for parsed_action, expected_action in zip(
            parsed_actions, output["expected_actions"]
        ):
            assert parsed_action.attrib["tool"] == expected_action.tool
            assert parsed_action.text.strip() == expected_action.input.strip()
