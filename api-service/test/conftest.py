import pytest
from typing import Dict, List, Any, cast

from codegen.agent.parsing import ToolLog, parse_thoughts_and_actions


class Helpers:
    @staticmethod
    def test_llm_outputs_parsing(llm_outputs: List[Dict[str, Any]]):
        """Test LLM action parsing."""

        for output in llm_outputs:
            actions = (
                cast(ToolLog, action)
                for action in parse_thoughts_and_actions(output["llm_output"])
                if action["type"] == "tool"
            )

            for action, expected_action in zip(
                actions, cast(List[ToolLog], output["expected_actions"])
            ):
                assert action["tool_name"] == expected_action["tool_name"]
                assert (
                    action.get("tool_input", "")
                    .strip()
                    .startswith(expected_action.get("tool_input").strip())
                )

            print("-----------")


@pytest.fixture
def helpers():
    return Helpers
