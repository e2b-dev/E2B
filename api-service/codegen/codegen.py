from typing import List, Tuple, List, Any, Dict

from pydantic import BaseModel
from langchain.llms.openai import OpenAIChat, OpenAI
from langchain.chat_models import ChatOpenAI
from langchain.callbacks.base import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.agents import AgentExecutor

# from codegen.tools.documentation import ReadDocumentation
from codegen.env import EnvVar
from codegen.js_agent import create_js_agent
from codegen.prompt import PREFIX, SUFFIX, FORMAT_INSTRUCTIONS
from codegen.tools.playground import create_playground_tools
from database import Database

from codegen.tools.playground import create_playground_tools
from codegen.agent import CodegenAgent
from codegen.prompt import PREFIX, SUFFIX, FORMAT_INSTRUCTIONS


class Codegen(BaseModel):
    agent: CodegenAgent
    agent_executor: AgentExecutor
    llm = ChatOpenAI(
        streaming=True,
        temperature=0,
        max_tokens=2056,
        verbose=True,
        callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]),
    )
    input_variables = ["input", "agent_scratchpad", "method"]
    tools = []

    @classmethod
    def from_playground_tools(cls, playground_tools: Tuple[List[Any]]):
        c = cls()
        print(c.input_variables)
        print(c.tools)

        # Create prompt
        prompt = CodegenAgent.create_prompt(
            tools=[
                *playground_tools,
                *c.tools,
            ],
            prefix=PREFIX,
            suffix=SUFFIX,
            format_instructions=FORMAT_INSTRUCTIONS,
            input_variables=c.input_variables,
        )

        # Create CodegenAgent and its executor
        c.agent = CodegenAgent.from_llm_and_tools(
            llm=c.llm,
            tools=[
                *playground_tools,
                *c.tools,
            ],
            prefix=PREFIX,
            suffix=SUFFIX,
            format_instructions=FORMAT_INSTRUCTIONS,
            input_variables=c.input_variables,
        )
        c.agent_executor = AgentExecutor.from_agent_and_tools(
            agent=c.agent,
            tools=[
                *playground_tools,
                *c.tools,
            ],
            verbose=True,
        )

        return c

    def generate():
        # TODO
        pass


cg = Codegen()


def generate_req_handler(
    db: Database,
    run_id: str,
    blocks: List[Dict],
    method: str,
    route: str,
    envs: List[EnvVar],
):
    request_body_blocks = [
        block for block in blocks if block.get("type") == "RequestBody"
    ]
    request_body_template = (
        request_body_blocks[0]["prompt"] if len(request_body_blocks) > 0 else None
    )
    playground_tools, playground = create_playground_tools(
        envs=envs,
        route=route,
        method=method,
        request_body_template=request_body_template,
    )

    steps = ""
    for idx, block in enumerate(blocks):
        if block.get("type") == "Basic":
            steps = steps + "\n" + "{}. ".format(idx + 1) + block["prompt"] + "\n"
    tool_names = ["InstallNPMDependencies", "RunJavaScriptCode"]
    prefix = PREFIX.format(
        method=method,
        tool_names=tool_names,
        steps=steps,
        request_body=request_body_template,
    )
    format_instructions = FORMAT_INSTRUCTIONS.format(
        tool_names=tool_names,
    )
    executor = create_js_agent(
        db=db,
        run_id=run_id,
        llm=OpenAI(temperature=0, max_tokens=1000),
        # llm=OpenAI(temperature=0, model_name='code-davinci-002', max_tokens=1000),
        # llm=OpenAIChat(temperature=0, max_tokens=1000),
        tools=[
            # ReadDocumentation()
            *playground_tools,
        ],
        verbose=True,
        prefix=prefix,
        format_instructions=format_instructions,
    )

    # Convert env vars to Javascript comments, each on its on line for each env var.
    # envs_str = ""
    # for env in envs:
    #     envs_str += f'// const {env["key"]} = `env.{env["key"]}`\n'

    # prompt = PREFIX.format(
    #     method=method, envs=envs_str, request_body=request_body_template
    # )

    # for idx, block in enumerate(blocks):
    #     if block.get("type") == "Basic":
    #         prompt = prompt + "\n" + "{}. ".format(idx + 1) + block["prompt"] + "\n"

    # prompt = prompt + "\n" + SUFFIX.format(method=method)

    # handler_code = executor.run(prompt).strip("`").strip()
    handler_code = executor.run(f"Requirement:").strip("`").strip()
    print("CODE")
    print(handler_code)

    playground.close()

    return "", handler_code
