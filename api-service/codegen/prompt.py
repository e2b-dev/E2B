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

You can access environment variables through the `env` parameter. You have access to the following environment variables:
{envs}

You can install any package that you might need.

The incoming request content-type is application/json.

The incoming request payload looks like this:
```
{request_body}
```

Here is the starting code that handles the initialization. The function that you need to complete is marked with a TODO comment:
```
import {{ Router }} from 'itty-router'

const router = Router()

async function handle{method}Request(request, env) {{
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
