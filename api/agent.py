# https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/python

from http.server import BaseHTTPRequestHandler
from datetime import datetime

class handler(BaseHTTPRequestHandler):

  def do_GET(self):
    self.send_response(200)
    self.send_header('Content-type', 'text/plain')
    self.end_headers()
    self.wfile.write(str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')).encode())
    return


# import os
# import yaml
# from __future__ import annotations
# from typing import Any, Optional, List
# from langchain.agents.agent import AgentExecutor
# from langchain.agents.agent_toolkits.base import BaseToolkit
# from langchain.agents.agent_toolkits.json.base import create_json_agent
# from langchain.agents.agent_toolkits.json.toolkit import JsonToolkit
# from langchain.agents.agent_toolkits.openapi.prompt import DESCRIPTION
# from langchain.agents.tools import Tool
# from langchain.llms.base import BaseLLM
# from langchain.requests import RequestsWrapper
# from langchain.tools import BaseTool
# from langchain.tools.json.tool import JsonSpec
# from langchain.agents.mrkl.base import ZeroShotAgent
# from langchain.callbacks.base import BaseCallbackManager
# from langchain.chains.llm import LLMChain
# from langchain.tools.python.tool import PythonREPLTool
# from langchain.llms.openai import OpenAI
# from langchain.agents.agent_toolkits.openapi.prompt import (
#     OPENAPI_PREFIX,
#     OPENAPI_SUFFIX,
# )
# from langchain.agents.agent_toolkits.openapi.toolkit import OpenAPIToolkit
# from langchain.agents.mrkl.prompt import FORMAT_INSTRUCTIONS

# os.environ["OPENAI_API_KEY"] =

# PREFIX = """You are an agent designed to write code to answer questions.
# You have access to a python REPL, which you can use to execute python code to make sure it's the correct code and runs without errors.
# If you get an error, debug your code and try again.
# The final asnwer must only the code that can directly run. Don't output any additional text.
# You must return all code needed to get the answer, not just a single function call.
# You might know the answer without running any code, but you should still run the code to get the answer.
# If it does not seem like you can write code to answer the question, just return "I don't know" as the answer.
# """

# def create_python_agent(
#     llm: BaseLLM,
#     tool: PythonREPLTool,
#     callback_manager: Optional[BaseCallbackManager] = None,
#     verbose: bool = False,
#     prefix: str = PREFIX,
#     **kwargs: Any,
# ) -> AgentExecutor:
#     """Construct a python agent from an LLM and tool."""
#     tools = [tool]
#     prompt = ZeroShotAgent.create_prompt(tools, prefix=prefix)
#     llm_chain = LLMChain(
#         llm=llm,
#         prompt=prompt,
#         callback_manager=callback_manager,
#     )
#     tool_names = [tool.name for tool in tools]
#     agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names, **kwargs)
#     return AgentExecutor.from_agent_and_tools(agent=agent, tools=tools, verbose=verbose)


# class OpenAPIToolkit(BaseToolkit):
#     """Toolkit for interacting with a OpenAPI api."""

#     json_agent: AgentExecutor
#     python_agent: AgentExecutor

#     def get_tools(self) -> List[BaseTool]:
#         """Get the tools in the toolkit."""
#         json_agent_tool = Tool(
#             name="json_explorer",
#             func=self.json_agent.run,
#             description=DESCRIPTION,
#         )
#         python_agent_tool = Tool(
#             name="python_generator",
#             func=self.python_agent.run,
#             description=""
#         )
#         # request_toolkit = RequestsToolkit(requests_wrapper=self.requests_wrapper)
#         return [python_agent_tool, json_agent_tool]

#     @classmethod
#     def from_llm(
#         cls,
#         llm: BaseLLM,
#         json_spec: JsonSpec,
#         **kwargs: Any,
#     ) -> OpenAPIToolkit:
#         """Create json agent from llm, then initialize."""
#         json_agent = create_json_agent(llm, JsonToolkit(spec=json_spec), **kwargs)
#         python_agent = create_python_agent(
#             llm=OpenAI(temperature=0, max_tokens=1000),
#             tool=PythonREPLTool(),
#             verbose=True
#         )
#         return cls(json_agent=json_agent, python_agent=python_agent)


# def create_openapi_agent(
#     llm: BaseLLM,
#     toolkit: OpenAPIToolkit,
#     callback_manager: Optional[BaseCallbackManager] = None,
#     prefix: str = OPENAPI_PREFIX,
#     suffix: str = OPENAPI_SUFFIX,
#     format_instructions: str = FORMAT_INSTRUCTIONS,
#     input_variables: Optional[List[str]] = None,
#     verbose: bool = False,
#     **kwargs: Any,
# ) -> AgentExecutor:
#     """Construct a json agent from an LLM and tools."""
#     tools = toolkit.get_tools()
#     prompt = ZeroShotAgent.create_prompt(
#         tools,
#         prefix=prefix,
#         suffix=suffix,
#         format_instructions=format_instructions,
#         input_variables=input_variables,
#     )
#     llm_chain = LLMChain(
#         llm=llm,
#         prompt=prompt,
#         callback_manager=callback_manager,
#     )
#     tool_names = [tool.name for tool in tools]
#     agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names, **kwargs)
#     return AgentExecutor.from_agent_and_tools(
#         agent=agent, tools=toolkit.get_tools(), verbose=verbose
#     )

# with open("devbook_openapi.yml") as f:
#     data = yaml.load(f, Loader=yaml.FullLoader)
# json_spec=JsonSpec(dict_=data, max_value_length=40000)
# headers = {
#     "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}"
# }
# openapi_toolkit = OpenAPIToolkit.from_llm(OpenAI(temperature=0), json_spec, verbose=True)
# openapi_agent_executor = create_openapi_agent(
#     llm=OpenAI(temperature=0),
#     toolkit=openapi_toolkit,
#     verbose=True
# )

# openapi_agent_executor.run("Write a python function that makes a post request to devbook /sessions/{sessionID}/refresh to every 5 seconds. The sessionID is '1234'.")