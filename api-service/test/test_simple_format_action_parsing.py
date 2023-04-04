"""Test LLM incomplete action parsing"""

from typing import Dict, List, Any

from codegen.agent.parsing import ToolLog

llm_outputs: List[Dict[str, Any]] = [
    {
        "llm_output": """
Install JavaScript packages with NPM. The input should be valid names of NPM packages. Example usage:
        <action tool="InstallNPMDependencies">
        package_name_1 package_name_2
        </action>
""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="InstallNPMDependencies",
                tool_input="package_name_1 package_name_2",
            ),
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
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What should the post request handler do?",
            ),
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
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What should the post request handler do?",
            ),
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What",
            ),
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
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What should the post request handler do?",
            ),
            ToolLog(
                type="tool",
                tool_name="AskHuman",
                tool_input="What",
            ),
        ],
    },
]


def test_parsing_llm_simple_format_action_output(helpers):
    """Test LLM action parsing."""
    helpers.test_llm_outputs_parsing(llm_outputs)
