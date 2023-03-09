from typing import List
import uuid

from langchain.llms.openai import OpenAIChat, OpenAI
from codegen.tools.javascript.tool import JavascriptEvalTool
from codegen.js_agent.base import create_js_agent
from codegen.prompt import PREFIX, SUFFIX


def generate_req_handler(project_id: str, route_id: str, blocks: List[str], method: str) -> str:
    run_id = str(uuid.uuid4())

    executor = create_js_agent(
        run_id=run_id,
        project_id=project_id,
        route_id=route_id,
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
