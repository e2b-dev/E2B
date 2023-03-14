from typing import Any, Optional, List

from langchain.agents.agent import AgentExecutor
from langchain.callbacks.base import BaseCallbackManager
from langchain.llms.base import BaseLLM
from langchain.agents.mrkl.base import ZeroShotAgent
from langchain.agents.chat.base import ChatAgent
from langchain.chains.llm import LLMChain
from langchain.callbacks.shared import SharedCallbackManager
from langchain.tools.base import BaseTool
from langchain.agents import initialize_agent
from langchain.chat_models import ChatOpenAI

# from codegen.js_agent.prompt import PREFIX
from codegen.prompt import PREFIX, SUFFIX, FORMAT_INSTRUCTIONS
from codegen.js_agent.callbacks.log import LoggerCallbackHandler
from database import Database


def create_js_agent(
    db: Database,
    run_id: str,
    llm: BaseLLM,
    tools: List[BaseTool],
    prefix: str,
    format_instructions: str,
    callback_manager: Optional[BaseCallbackManager] = None,
    verbose: bool = False,
    **kwargs: Any,
) -> AgentExecutor:
    """Construct a javascript agent that generates code from an LLM and tool."""

    print(prefix)
    print(format_instructions)

    # prompt = ChatAgent.create_prompt(
    #     # tools=tools,
    #     prefix=prefix,
    #     format_instructions=format_instructions,
    #     # suffix="MY_CUSTOM_SUFFIX",
    # )

    # llm = ChatOpenAI(temperature=0)
    # # llm1 = OpenAI(temperature=0)
    # llm_chain = LLMChain(
    #     llm=llm,
    #     verbose=verbose,
    #     # prompt=prompt,
    #     # callback_manager=callback_manager,
    # )

    mrkl_agent = initialize_agent(
        tools,
        llm=llm,
        # llm_chain=llm_chain,
        agent="chat-zero-shot-react-description",
        verbose=verbose,
        # prompt=prompt,
        prefix=PREFIX,
        format_instructions=FORMAT_INSTRUCTIONS,
    )
    return mrkl_agent
    # return AgentExecutor.from_agent_and_tools(
    #     agent=mrkl_agent,
    #     tools=tools,
    #     verbose=verbose,
    # )

    prompt = ZeroShotAgent.create_prompt(tools=tools, prefix=prefix)
    llm_chain = LLMChain(
        llm=llm,
        verbose=verbose,
        prompt=prompt,
        callback_manager=callback_manager,
    )
    tool_names = [tool.name for tool in tools]
    agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names, **kwargs)

    cb_manager = SharedCallbackManager()
    cb_manager.set_handler(LoggerCallbackHandler(db=db, run_id=run_id))
    return AgentExecutor.from_agent_and_tools(
        agent=agent, tools=tools, verbose=verbose, callback_manager=cb_manager
    )
