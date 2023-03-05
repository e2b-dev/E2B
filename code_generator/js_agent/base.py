from typing import Any, Optional

from langchain.agents.agent import AgentExecutor
from langchain.callbacks.base import BaseCallbackManager
from langchain.llms.base import BaseLLM
from langchain.agents.mrkl.base import ZeroShotAgent
from langchain.chains.llm import LLMChain

from code_generator.js_agent.prompt import PREFIX


def create_js_agent(
    llm: BaseLLM,
    # TODO: Create JavascriptExecTool
    # tool: JsonToolkit,
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
    return AgentExecutor.from_agent_and_tools(
        agent=agent,
        tools=tools,
        verbose=verbose,
    )
