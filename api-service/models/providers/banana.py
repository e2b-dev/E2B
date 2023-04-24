from typing import Dict, List, Optional
from pydantic import root_validator
from langchain.llms import Banana

class BananaFix(Banana):
    # Override checks for the env vars
    @root_validator()
    def validate_environment(cls, values: Dict) -> Dict:
        return values

    async def _acall(self, prompt: str, stop: Optional[List[str]] = None):
        """Call to banana model"""
        output = self._call(prompt,stop)
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