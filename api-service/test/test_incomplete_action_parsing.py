"""Test LLM incomplete action parsing"""

from typing import Dict, List, Any

from agent.output.parse_output import ToolLog

llm_outputs: List[Dict[str, Any]] = [
    {
        "llm_output": """Action:
<action tool="AskHuman">
What should the post request handler do?
</action
""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What should the post request handler do?",
            )
        ],
    },
    {
        "llm_output": """Action:
<action tool="AskHuman">
What should the post request handler do?
</""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What should the post request handler do?\n</",
            )
        ],
    },
]


def test_parsing_llm_incomplete_action_output(helpers):
    """Test LLM action parsing."""
    helpers.test_llm_outputs_parsing(llm_outputs)
