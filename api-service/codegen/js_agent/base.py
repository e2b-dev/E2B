from typing import Any, Optional

from langchain.agents.agent import AgentExecutor
from langchain.agents import initialize_agent
from langchain.callbacks.base import BaseCallbackManager
from langchain.llms.base import BaseLLM
from langchain.agents.mrkl.base import ZeroShotAgent
from langchain.chains.llm import LLMChain
from langchain.callbacks.shared import SharedCallbackManager

from codegen.js_agent.prompt import PREFIX
from codegen.tools.javascript.tool import JavascriptEvalTool
from codegen.js_agent.callbacks.log import LoggerCallbackHandler
# from js_agent.prompt import PREFIX
# from tools.javascript.tool import JavascriptEvalTool


def create_js_agent(
    run_id: str,
    project_id: str,
    route_id: str,
    llm: BaseLLM,
    tool: JavascriptEvalTool,
    callback_manager: Optional[BaseCallbackManager] = None,
    verbose: bool = False,
    prefix: str = PREFIX,
    **kwargs: Any,
) -> AgentExecutor:
    """Construct a javascript agent that generates code from an LLM and tool."""
    tools = [tool]
    prompt = ZeroShotAgent.create_prompt(
        tools=tools,
        prefix=prefix
    )
    llm_chain = LLMChain(
        llm=llm,
        prompt=prompt,
        callback_manager=callback_manager,
    )
    tool_names = [tool.name for tool in tools]
    agent = ZeroShotAgent(llm_chain=llm_chain,
                          allowed_tools=tool_names, **kwargs)

    cb_manager = SharedCallbackManager()
    cb_manager.set_handler(LoggerCallbackHandler(
        run_id=run_id, project_id=project_id, route_id=route_id))
    return AgentExecutor.from_agent_and_tools(
        agent=agent,
        tools=tools,
        verbose=verbose,
        callback_manager=cb_manager
    )
