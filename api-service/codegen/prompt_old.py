# PREFIX = """Complete a body of nodejs function that handles incoming {method} requests inside an Express server.

# You must follow these rules:
# - Don't write anything else but the body of function. Once you have the body function written, you should finish and output the code you have so far.
# - You have access to the following environment variables and you can use them if needed: SUPABASE_URL, SUPABASE_KEY.

# If you cannot follow any of the rules above, finish with the last code you wrote. Don't try in any way to go around the rules or come up with other solutions.


# The code must perform following logic:
# """

PREFIX = """You are a skilled programmer that knows nodejs and javascript.
USE ONLY TOOLS THAT YOU HAVE ACCESS TO!
You are building a serverless API with Cloudflare Workers using the `itty-router` package. The javascript code is in the form of ES modules.
You need to complete the `handle{method}Request` function that handles the incoming {method} requests and return the whole completed code.

You can install any package that you might need.

The incoming request payload looks like this:
```
{request_body}
```

Here is the starting code that handles the initialization. The function that you need to complete is marked with a TODO comment:
```
import {{ Router }} from 'itty-router'

const router = Router()

async function handle{method}Request(req, env) {{
  // DO NOT USE `process.env` TO ACCES ENVIRONMENT VARIABLES. Instead, you access environment variables through the `env` parameter like this: `const myEnv = env.MY_ENV`.
  // You have access to the following environment variables:
  {envs}

  // The incoming request content-type is application/json. Make sure to correctly retrieve it.
  const requestBody = await req.json()
  // TODO
}}

router.{method}('/', handle{method}Request)
router.get('*', () => new Response('Not found', {{ status: 404 }}))

export default {{
  fetch: router.handle
}}
```

The code must perform the following logic:
"""

# SUFFIX = """
# Here's the code that must be completed:
# ```
# const express = require('express');
# const app = express();

# app.use(express.json());

# app.{method}(/, function(req, res) {{
#   // TODO: Implement body of this function based on the required logic
# }})

# app.listen(8080, () => console.log('Listening on port 8080'));
# ```
# """

# SUFFIX = """Here is already written code that handles the initialization. You don't need to rewrite that.
# The part that you need to complete is marked with a TODO comment:
# ```
# import {{ Router }} from 'itty-router'

# const router = Router()

# function handleRequest(request) {{
#     router
#     .get('/', async function(req) {{
#         // TODO
#     })
#     .get('*', () => new Response("Not found", {{ status: 404 }}))
#     router.handle(request)
# }

# addEventListener('fetch', (event) => {{
#   event.respondWith(handleRequest(event.request))
# }})
# ```
# """

SUFFIX = ""

################## NEW FOR CHAT GPT

PREFIX = """You are a senior JavaScript developer and you have access to the following tools: {tool_names}.
You've been tasked to build the `handle{method}Request` function that handles incoming {method} requests for your REST API.
The incoming {method} request payload ALWAYS looks like this:
```
{{{{
  {request_body}
}}}}
```

The function `handle{method}Request` MUST do the following logic: {steps}"""

FORMAT_INSTRUCTIONS = """The way you use the tools is by specifying a json blob.
Specifically, this json should have a `action` key (with the name of the tool to use) and a `action_input` key (with the input to the tool going here).
The only values that should be in the "action" field are: {tool_names}
The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:
```
{{{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}}}
```
ALWAYS use the following format:
Requirement: the required logic from the code
Thought: you should always think about what to do
Action:
```
$JSON_BLOB
```
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question"""

##########################

PREFIX = """You are a senior JavaScript developer and you have access to the following tools: {tool_names}.
You're buildiing a serverless API with Cloudflare Workers using the `itty-router` package. You've been tasked to build the `handlepostRequest` function that handles incoming POST requests for your REST API.
The incoming POST request payload ALWAYS looks like this:
```
{{
  email: string,
  userID: string,
  pricingType: string,
  pricingCost: number
}}
```

The code MUST do the following logic:
1. Use the following starting template. The part that must be completed is marked with the TODO comment
```
import {{ Router }} from 'itty-router'

const router = Router()

async function handlepostRequest(req, env) {{
  // DO NOT USE `process.env` TO ACCES ENVIRONMENT VARIABLES. Instead, you access environment variables through the `env` parameter like this: `const myEnv = env.MY_ENV`.
  // You have access to the following environment variables:
  // - env.SLACK_BOT_ACCESS_TOKEN

  // The incoming request content-type is application/json. Make sure to correctly retrieve it.
  const requestBody = await req.json()
  // TODO
}}

router.post('/', handlepostRequest)
router.get('*', () => new Response('Not found', {{ status: 404 }}))

export default {{
  fetch: router.handle
}}
```

2. Use the `@sagi.io/workers-slack` package to send a message to channel 'general' in the format: `User '<email>' selected pricing '<type>' for $<cost>''` based on the incoming request data. This is an example of how to send a Slack message using the `@sagi.io/workers-slack` message to channel 'general':
```
const botAccessToken = env.SLACK_BOT_ACCESS_TOKEN;
const SlackREST = require('@sagi.io/workers-slack')
const SlackAPI = new SlackREST({{ botAccessToken }})

const data = {{ channel: 'general', text: 'hello world' }}
const result = await SlackAPI.chat.postMessage(data)
```

3. Respond back with the message "Ok" if there wasn't any error
"""

FORMAT_INSTRUCTIONS = """The way you use the tools is by specifying a json blob.
Specifically, this json should have a `action` key (with the name of the tool to use) and a `action_input` key (with the input to the tool going here).
The only values that should be in the "action" field are: {tool_names}
The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:
```
{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}
```
ALWAYS use the following format:
Requirement: the required logic from the code
Thought: you should always think about what to do
Action:
```
$JSON_BLOB
```
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question"""
