from typing import Dict, Any, List, Union
import sys

from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import AgentAction, AgentFinish, LLMResult


class CustomCallbackHandler(BaseCallbackHandler):
    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Run when LLM starts running."""
        pass

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new LLM token. Only available when streaming is enabled."""
        pass

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Run when LLM ends running."""
        pass

    def on_llm_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when LLM errors."""
        pass

    def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        """Run when chain starts running."""
        pass

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        """Run when chain ends running."""
        pass

    def on_chain_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when chain errors."""
        pass

    def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        """Run when tool starts running."""
        print("[+CustomCallbackHandler] TOOL START", flush=True)
        print(serialized)
        print(input_str)
        print("[-CustomCallbackHandler]")
        sys.stdout.flush()

    def on_tool_end(self, output: str, **kwargs: Any) -> None:
        """Run when tool ends running."""
        print("[+CustomCallbackHandler] TOOL END", flush=True)
        print(output)
        print("[-CustomCallbackHandler]")
        sys.stdout.flush()

    def on_tool_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when tool errors."""
        print("[+CustomCallbackHandler] TOOL ERROR")
        print(error)
        print("[-CustomCallbackHandler]")
        sys.stdout.flush()

    def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Run on agent action."""
        print("[+CustomCallbackHandler] AGENT ACTION", flush=True)
        print(action.tool)
        print(action.log)
        print(action.tool_input)
        print("[-CustomCallbackHandler]")
        sys.stdout.flush()

    def on_text(self, text: str, **kwargs: Any) -> None:
        """Run on arbitrary text."""
        pass

    def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> None:
        """Run on agent end."""
        pass
