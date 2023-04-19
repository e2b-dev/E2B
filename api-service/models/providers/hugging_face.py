from typing import List, Optional
from langchain.llms.base import LLM
from langchain.llms import HuggingFaceEndpoint, HuggingFaceHub


class HuggingFaceHubFix(HuggingFaceHub):
    async def _acall(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        output = self._call(prompt, stop)
        if self.callback_manager.is_async:
            await self.callback_manager.on_llm_new_token(
                output,
                verbose=self.verbose,
                # We explicitly flush the logs in log queue because the calls to this model are not actually async so they block.
                flush=True,
            )
        else:
            self.callback_manager.on_llm_new_token(
                output,
                verbose=self.verbose,
            )

        return output

class HuggingFaceEndpointFix(HuggingFaceEndpoint):
    async def _acall(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        output = self._call(prompt, stop)
        if self.callback_manager.is_async:
            await self.callback_manager.on_llm_new_token(
                output,
                verbose=self.verbose,
                # We explicitly flush the logs in log queue because the calls to this model are not actually async so they block.
                flush=True,
            )
        else:
            self.callback_manager.on_llm_new_token(
                output,
                verbose=self.verbose,
            )

        return output
