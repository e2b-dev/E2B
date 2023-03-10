from typing import List

from langchain.llms.openai import OpenAIChat, OpenAI
from codegen.tools.javascript.tool import JavascriptEvalTool
from codegen.tools.documentation.tool import ReadDocumentation
from codegen.js_agent.base import create_js_agent
from codegen.prompt import PREFIX, SUFFIX
from codegen.db.base import Database


def generate_req_handler(
    db: Database,
    run_id: str,
    project_id: str,
    route_id: str,
    blocks: List[str],
    method: str,
) -> str:
    executor = create_js_agent(
        db=db,
        run_id=run_id,
        project_id=project_id,
        route_id=route_id,
        llm=OpenAI(temperature=0, max_tokens=1000),
        # llm=OpenAI(temperature=0, model_name='code-davinci-002', max_tokens=1000),
        # llm=OpenAIChat(temperature=0, max_tokens=1000),
        # tools=[JavascriptEvalTool(), ReadDocumentation()],
        tools=[JavascriptEvalTool()],
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
