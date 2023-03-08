from typing import List
import uuid

from langchain.llms.openai import OpenAIChat, OpenAI
from codegen.tools.javascript.tool import JavascriptEvalTool
from codegen.js_agent.base import create_js_agent


# PREFIX = """Complete a body of nodejs function that handles incoming {method} requests inside an Express server.

# You must follow these rules:
# - Don't write anything else but the body of function. Once you have the body function written, you should finish and output the code you have so far.
# - You have access to the following environment variables and you can use them if needed: SUPABASE_URL, SUPABASE_KEY.

# If you cannot follow any of the rules above, finish with the last code you wrote. Don't try in any way to go around the rules or come up with other solutions.


# The code must perform following logic:
# """

PREFIX = """You are a skilled programmer that knows nodejs and javascript.
You are building a serverless API with Cloudflare Workers using the 'itty-router' package (code and docs is here https://github.com/kwhitley/itty-router).
You need to complete the `handle{method}Request` function that handles the incoming {method} requests.

Here is some already written code that handles the initialization. The function that you need to complete is marked with a TODO comment:
```
import {{ Router }} from 'itty-router'

const router = Router()

function handle{method}Request(request) {{
    // TODO
}}

addEventListener('fetch', (event) => {{
    router
    .{method}('/', handle{method}Request)
    .get('*', () => new Response("Not found", {{ status: 404 }}))
    router.handle(event.request)
}})
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


def generate_req_handler(project_id: str, blocks: List[str], method: str) -> str:
    run_id = str(uuid.uuid4())

    executor = create_js_agent(
        run_id=run_id,
        project_id=project_id,
        llm=OpenAI(temperature=0, max_tokens=1000),
        # llm=OpenAI(temperature=0, model_name='code-davinci-002', max_tokens=1000),
        # llm=OpenAIChat(temperature=0, max_tokens=1000),
        tool=JavascriptEvalTool(),
        verbose=True,
    )

    prompt = PREFIX.format(method=method)

    for idx, block in enumerate(blocks):
        prompt = prompt + "\n" + "{}. ".format(idx + 1) + block + "\n"

    prompt = prompt + "\n" + SUFFIX.format(method=method)

    handler_code = executor.run(prompt).strip("`").strip()
    return prompt, handler_code
    # server_code = server_template.replace('[HANDLER]', handler_code)
    # return server_code
