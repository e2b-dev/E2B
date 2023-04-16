from typing import List, Optional
from langchain.llms import HuggingFaceEndpoint
from langchain.schema import LLMResult


class HuggingFaceEndpointFix(HuggingFaceEndpoint):
    def agenerate(
        self, prompts: List[str], stop: Optional[List[str]] = None
    ) -> LLMResult:
        return self.generate(prompts, stop)
