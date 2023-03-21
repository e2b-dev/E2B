"""Test LLM action parsing"""

# import pytest

from typing import Dict, List, NamedTuple
from codegen.agent.base import (
    separate_thought_and_action,
    parse_action_string,
)


class Action(NamedTuple):
    tool: str
    input: str


llm_outputs: List[Dict[str, str]] = [
    {
        "llm_output": """Thought: Lorem ipsum

Action:
```
<action tool="Name">
action input
</action>
```""",
        "expected_actions": [Action("Name", "action input")],
    },
    {
        "llm_output": """Thought: Lorem ipsum

Action:
```
<action tool="Name">
action input
</action>
<action tool="Name 2">
action input 2
</action>
```""",
        "expected_actions": [
            Action("Name", "action input"),
            Action("Name 2", "action input 2"),
        ],
    },
    {
        "llm_output": """
Thought: lorem ipsum

Action:
```
<action tool="Name1">content</action 1><action tool="Name2">content 2</action><action tool="Name3">content 3</action>'
```
""",
        "expected_actions": [
            Action(tool="Name1", input="content"),
            Action(tool="Name2", input="content 2"),
            Action(tool="Name3", input="content 3"),
        ],
    },
    {
        "llm_output": """Thought: I need to install the `email-validator` package using `InstallNPMDependencies`. Then, I need to write the post handler function that checks if the email is valid and sends the appropriate response. Finally, I need to add the post handler to the Express app and start the server using `app.listen()`.

Action:
```
<action tool="InstallNPMDependencies">
email-validator
</action>
```

```
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
```

""",
        "expected_actions": [
            Action(tool="InstallNPMDependencies", input="email-validator"),
            Action(
                tool="RunJavaScriptCode",
                input="""import express from 'express';
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
]

# llm_outputs = [
#     """Thought: I need to install the `email-validator` package using `InstallNPMDependencies`. Then, I need to write the post handler function that checks if the email is valid and sends the appropriate response. Finally, I need to add the post handler to the Express app and start the server using `app.listen()`.

# Action:
# ```
# <action tool="InstallNPMDependencies">
# email-validator
# </action>
# ```

# ```
# <action tool="RunJavaScriptCode">
# import express from 'express';
# import validator from 'email-validator';

# const app = express();
# const port = 3000;

# app.use(express.json());

# app.post('/', (req, res) => {
#   const email = req.body.email;
#   if (!validator.validate(email)) {
#     res.status(400).json({ error: 'Invalid email format' });
#   } else {
#     res.status(200).json({});
#   }
# });

# app.listen(port, () => {
#   console.log(`Server listening on port ${port}`);
# });
# </action>
# ```

# """,
#     '<action tool="Name">content</action>',
#     """
# Thought: lorem ipsum

# Action:
# ```
# <action tool="Name1">content</action 1><action tool="Name2">content 2</action><action tool="Name3">content 3</action>'
# ```
# """,
# ]


def test_parsing_llm_action_output():
    """Test LLM action parsing."""

    for output in llm_outputs:
        _, action_string = separate_thought_and_action(output["llm_output"])
        parsed_actions = parse_action_string(action_string)

        for parsed_action, expected_action in zip(
            parsed_actions, output["expected_actions"]
        ):
            assert parsed_action.attrib["tool"] == expected_action.tool
            assert parsed_action.text.strip() == expected_action.input.strip()
