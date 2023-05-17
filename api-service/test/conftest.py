import pytest
from typing import Dict, List, Any, cast

from agent.output.parse_output import ToolLog, parse_output


class Helpers:
    @staticmethod
    def test_llm_outputs_parsing(llm_outputs: List[Dict[str, Any]]):
        """Test LLM action parsing."""

        for output in llm_outputs:
            actions = [
                cast(ToolLog, action)
                for action in parse_output(output["llm_output"])
                if action["type"] == "tool"
            ]

            assert len(actions) == len(output["expected_actions"])

            for action, expected_action in zip(
                actions, cast(List[ToolLog], output["expected_actions"])
            ):
                assert action["tool_name"] == expected_action["tool_name"]
                assert (
                    action["tool_input"].strip()
                    == expected_action["tool_input"].strip()
                )

            print("-----------")


@pytest.fixture
def helpers():
    return Helpers
