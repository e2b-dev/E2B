from typing import List, Dict, Optional, Any, Union

from langchain.callbacks.base import BaseCallbackHandler
from langchain.input import print_text, get_colored_text
from langchain.schema import AgentAction, AgentFinish, LLMResult

# from codegen.db.base import push_logs
from codegen.db.base import Database


class LoggerCallbackHandler(BaseCallbackHandler):
    """Callback Handler that prints to std out."""

    def __init__(
        self,
        db: Database,
        run_id: str,
        color: Optional[str] = None,
    ) -> None:
        """Initialize callback handler."""

        self.db = db

        self.run_id = run_id
        self.color = color
        self.logs = []

    def push_log(self, log: Optional[str]) -> None:
        if log is not None:
            self.logs.append(log)
            self.db.push_logs(
                run_id=self.run_id,
                logs=self.logs,
            )

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Print out the prompts."""
        pass

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Do nothing."""
        pass

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Do nothing."""
        pass

    def on_llm_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Do nothing."""
        pass

    def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        """Print out that we are entering a chain."""
        class_name = serialized["name"]
        db_log = f"**Entering new {class_name} chain...**\n\n---"
        self.push_log(db_log)

        log = f"\n\n\033[1m> Entering new {class_name} chain...\033[0m"
        print(log)

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        """Print out that we finished a chain."""
        db_log = "**Finished chain.**\n\n---\n"
        self.push_log(db_log)

        log = "\n\033[1m> Finished chain.\033[0m"
        print(log)

    def on_chain_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Do nothing."""
        pass

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any,
    ) -> None:
        """Do nothing."""
        pass

    def on_agent_action(
        self, action: AgentAction, color: Optional[str] = None, **kwargs: Any
    ) -> Any:
        """Run on agent action."""
        db_log = action.log
        self.push_log(db_log)

        c = color if color else self.color
        print_text(action.log, color=c)

    def on_tool_end(
        self,
        output: str,
        color: Optional[str] = None,
        observation_prefix: Optional[str] = None,
        llm_prefix: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """If not the final action, print out observation."""

        db_log = f"\n{observation_prefix}\n\n---"
        db_log += f"\n{output}\n\n---\n"
        db_log += f"\n{llm_prefix}\n"
        self.push_log(db_log)

        c = color if color else self.color
        print_text(f"\n{observation_prefix}")
        print_text(output, color=c)
        print_text(f"\n{llm_prefix}")
        # if output:

    def on_tool_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Do nothing."""
        pass

    def on_text(
        self,
        text: str,
        color: Optional[str] = None,
        end: str = "",
        **kwargs: Optional[str],
    ) -> None:
        """Run when agent ends."""

        db_log = f"{text}\n{end}\n\n---"
        self.push_log(db_log)

        c = color if color else self.color
        print_text(text, color=c, end=end)

    def on_agent_finish(
        self, finish: AgentFinish, color: Optional[str] = None, **kwargs: Any
    ) -> None:
        """Run on agent end."""

        db_log = f"{finish.log}\n\n---"
        self.push_log(db_log)

        print_text(finish.log, color=color if self.color else color, end="\n")
