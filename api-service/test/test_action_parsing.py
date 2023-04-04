"""Test LLM action parsing"""

from typing import Dict, List, Any

from codegen.agent.parsing import ToolLog


llm_outputs: List[Dict[str, Any]] = [
    {
        "llm_output": """Install JavaScript packages with NPM. The input should be valid names of NPM packages. Example usage:
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
        "llm_output": """Action:
<action tool="AskHuman">
What should the post request handler do?
</action>
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
        "llm_output": """Thought: Lorem ipsum

Action:
<action tool="Name">
action input
</action>
""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="Name",
                tool_input="action input",
            ),
        ],
    },
    {
        "llm_output": """Thought: Lorem ipsum

Action:
<action tool="Name">
action input
</action>
<action tool="Name 2">
action input 2
</action>
""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="Name",
                tool_input="action input",
            ),
            ToolLog(
                type="tool",
                tool_name="Name 2",
                tool_input="action input 2",
            ),
        ],
    },
    {
        "llm_output": """
Thought: lorem ipsum

Action:
<action tool="Name1">content</action 1><action tool="Name2">content 2</action><action tool="Name3">content 3</action>'

""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="Name1",
                tool_input="content",
            ),
            ToolLog(
                type="tool",
                tool_name="Name2",
                tool_input="content 2",
            ),
            ToolLog(
                type="tool",
                tool_name="Name3",
                tool_input="content 3",
            ),
        ],
    },
    {
        "llm_output": """Thought: I need to install the `email-validator` package using `InstallNPMDependencies`. Then, I need to write the post handler function that checks if the email is valid and sends the appropriate response. Finally, I need to add the post handler to the Express app and start the server using `app.listen()`.

Action:
<action tool="InstallNPMDependencies">
email-validator
</action>

<action tool="RunJavaScriptCode">
import express from 'express';
import validator from 'email-validator';

const app = express();
const port = 3000;

app.use(express.json());

app.post('/', (req, res) => {
  const email = req.body.email;
  if (!validator.validate(email)) {
    res.status(400).json({ error: 'Invalid email format' });
  } else {
    res.status(200).json({});
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
</action>


""",
        "expected_actions": [
            ToolLog(
                type="tool",
                tool_name="InstallNPMDependencies",
                tool_input="email-validator",
            ),
            ToolLog(
                type="tool",
                tool_name="RunJavaScriptCode",
                tool_input="""import express from 'express';
import validator from 'email-validator';

const app = express();
const port = 3000;

app.use(express.json());

app.post('/', (req, res) => {
  const email = req.body.email;
  if (!validator.validate(email)) {
    res.status(400).json({ error: 'Invalid email format' });
  } else {
    res.status(200).json({});
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});""",
            ),
        ],
    },
    {
        "llm_output": """
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


def test_parsing_llm_action_output(helpers):
    """Test LLM action parsing."""
    helpers.test_llm_outputs_parsing(llm_outputs)
