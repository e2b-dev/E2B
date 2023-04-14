from typing import Dict, List, Optional
from langchain.chat_models import ChatOpenAI
from langchain.llms import Replicate
from pydantic import root_validator
import replicate as replicate_python


class ReplicateFix(Replicate):
    # Override checks for the env vars
    @root_validator()
    def validate_environment(cls, values: Dict) -> Dict:
        return values

    async def _acall(self, prompt: str, stop: Optional[List[str]] = None):
        """Call to replicate endpoint."""
        # get the model and version
        model_str, version_str = self.model.split(":")

        client = replicate_python.Client(self.replicate_api_token)
        model = client.models.get(model_str)
        version = model.versions.get(version_str)

        # sort through the openapi schema to get the name of the first input
        input_properties = sorted(
            version.openapi_schema["components"]["schemas"]["Input"][
                "properties"
            ].items(),
            key=lambda item: item[1].get("x-order", 0),
        )
        first_input_name = input_properties[0][0]

        inputs = {first_input_name: prompt, **self.input}
        outputs = client.run(
            self.model,
            input={
                **inputs,
                **self.model_kwargs,
            },
        )

        text = ""
        for token in outputs:
            text += token
            if self.callback_manager.is_async:
                await self.callback_manager.on_llm_new_token(
                    token,
                    verbose=self.verbose,
                )
            else:
                self.callback_manager.on_llm_new_token(
                    token,
                    verbose=self.verbose,
                )

        return text
