from langchain import LLMChain
from langchain.agents import initialize_agent, AgentExecutor
from langchain.agents.chat.base import ChatAgent
from langchain.chat_models import ChatOpenAI
from langchain.callbacks.base import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain.schema import HumanMessage

from codegen.tools.playground import create_playground_tools


def create_prompt() -> ChatPromptTemplate:
    pass


OPENAI_API_KEY = "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"

PREFIX = """You are an AI programming assistant.



You have access to the following tools:"""

FORMAT_INSTRUCTIONS = """"""

##########

PREFIX = """You are an AI JavaScript/Nodejs assistant.
- Follow the user's requirements carefully & to the letter.
- Minimize any other prose.
- You are building an Express server that handles your REST API and you are required to complete the code based on the provided instructions.
- You are starting with the following code snippet:
```
import express from 'express';
const app = express();

// All incoming requests have payload in the JSON format.
app.use(express.json());

// The function we need to implement that must handle the {method} requests.
// We can make the function async if needed.
function handle{method}Request(req, res) {{
  // TODO: Complete the function based on the instructions
}}

app.{method}('/', handle{method}Request);

// Start the server
app.listen(3000, () => console.log('Listening on port 3000'));
```
- ALWAYS INCLUDE THE ABOVE CODE SNIPPET IN YOUR ANSWERS AND MAKE SURE IT'S JSON ESCAPED.
- You have access to the following tools:
"""

FORMAT_INSTRUCTIONS = """"The way you use the tools is by specifying a json blob.
Specifically, this json should have a `action` key (with the name of the tool to use) and a `action_input` key (with the input to the tool going here).
THE ONLY VALUES THAT SHOULD BE INT HE "action" FIELD ARE: {tool_names}. NO OTHER VALUES ARE ALLOWED.
The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:
```
{{{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}}}
```
ALWAYS use the following format and don't add additional empty new lines:


Instructions: the input instructions you must implement
Thought: you should always think about what to do
Action:
```
$JSON_BLOB
```
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final code that satisfies all the input instructions. THE FINAL ANSWER IT MUST BE JUST THE CODE."""

SUFFIX = """Begin! Reminder to NEVER use tools you don't have access to and ALWAYS use the exact characters `Final Answer` when responding."""


# Create model
cm = CallbackManager([StreamingStdOutCallbackHandler()])
chat = ChatOpenAI(
    openai_api_key=OPENAI_API_KEY,
    streaming=True,
    temperature=0,
    max_tokens=2056,
    verbose=True,
    callback_manager=cm,
)

# Initialize playground
playground_tools, playground = create_playground_tools(
    envs=[],
    route="/",
    method="post",
    request_body_template="email: string",
)

# Create prompt
input_variables = [
    "input",
    "agent_scratchpad",
    "method",
    # "instructions",
]
prompt = ChatAgent.create_prompt(
    tools=[
        *playground_tools,
    ],
    prefix=PREFIX,
    suffix=SUFFIX,
    format_instructions=FORMAT_INSTRUCTIONS,
    input_variables=input_variables,
)


# Create agent and it's executor
agent = ChatAgent.from_llm_and_tools(
    llm=chat,
    tools=playground_tools,
    prefix=PREFIX,
    suffix=SUFFIX,
    format_instructions=FORMAT_INSTRUCTIONS,
    input_variables=input_variables,
    verbose=True,
)
ae = AgentExecutor.from_agent_and_tools(agent=agent, tools=playground_tools)
# Run
ae.run(
    # "1. Check if the incoming request is POST request. If not, respond with an adequate error",
    agent_scratchpad="",
    input="""Here are the instructions from your boss:
1. Check if the incoming request is POST request. If not, respond with an adequate error.
2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.""",
    method="post",
    # instructions="""// 1. Check if the incoming request is POST request. If not, respond with an adequate error.
    # // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
    # """,
)


# agent_exec = initialize_agent(
#     tools=playground_tools,
#     llm=chat,
#     agent="chat-zero-shot-react-description",
#     agent_kwargs={
#         "prefix": PREFIX,
#         "suffix": SUFFIX,
#         "format_instructions": FORMAT_INSTRUCTIONS,
#         "input_variables": input_variables,
#         "verbose": True,
#     },
#     verbose=True,
# )
# agent_exec.run(
#     input="""// 1. Check if the incoming request is POST request. If not, respond with an adequate error.
# // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
# """,
#     agent_scratchpad="",
#     method="post",
#     instructions="""// 1. Check if the incoming request is POST request. If not, respond with an adequate error.
#     // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
#     """,
# )


# pprint(prompt.messages[0].prompt.template)
# print('++++++++')
# pprint(prompt.messages[1].prompt.template)

# prompts, _ = chain.prep_prompts(
#     [
#         {
#             "input": "",
#             "agent_scratchpad": "",
#             "method": "post",
#             "instructions": """// 1. Check if the incomign request is POST request. If not, respond with an adequate error.
# // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
# """,
#         }
#     ]
# )
# print(prompts)
# chain.run(
#     input="",
#     agent_scratchpad="",
#     method="post",
#     instructions="""// 1. Check if the incomign request is POST request. If not, respond with an adequate error.
# // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
# """,
# )


##############

# chat_messages = prompt.format_prompt(
#     agent_scratchpad="",
#     input="""// 1. Check if the incoming request is POST request. If not, respond with an adequate error.
# // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
# """,
#     method="post",
#     instructions="""// 1. Check if the incoming request is POST request. If not, respond with an adequate error.
# // 2. Retrieve email from the request payload and check if it's a valid email. Respond with 'Ok' if it is, otherwise respond with the adequate error.
# """,
# ).to_messages()

# instruct1 = "1. Check if the incoming request is POST request. If not, respond with an adequate error"
# instruct1_prompt = HumanMessage(content=instruct1)

# # chat([*chat_messages, instruct1_prompt])


playground.close()
